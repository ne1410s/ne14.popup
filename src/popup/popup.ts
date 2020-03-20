import { CustomElementBase } from '@ne1410s/cust-elems';

import markupUrl from './popup.html';
import stylesUrl from './popup.css';

export class Popup extends CustomElementBase {

  public static readonly observedAttributes = ['open', 'style'];

  private static readonly STYLE_KEYS = [ 
    'backgroundColor',
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomRightRadius',
    'borderBottomLeftRadius',
    'boxShadow',
  ];
  private _styles: Record<string, string> = {};
  private _coords: { x: number, y: number };
  private _drag: 'back' | 'fore' | 'fore*';
  private get canMove() { return this.hasAttribute('move'); }
  private get canResize() { return this.hasAttribute('resize'); }
  private get canClose() { return !this.hasAttribute('no-close'); }

  public confirmCallback: () => boolean;
  public dismissCallback: () => boolean;

  constructor() {
    super(stylesUrl, markupUrl);

    const back = this.root.querySelector('.back') as HTMLElement;
    const fore = back.querySelector('.fore') as HTMLElement;
    const resizer = fore.querySelector('.se-resize');
    const closer = fore.querySelector('.close');

    this.resetOffscreenPosition(fore);

    closer.addEventListener('click', () => this.close());
    resizer.addEventListener('mousedown', () => {
      fore.classList.toggle('over', this.canResize);
      fore.classList.toggle('resizing', this.canResize);
    });

    back.addEventListener('mousedown', event => {  
      this._drag = event.target === back ? 'back' 
          : event.target === fore ? 'fore'
          : 'fore*';
      this._coords = this._drag !== 'fore' ? null 
          : { x: event.offsetX, y: event.offsetY };
      fore.classList.toggle('moving', this.canMove && this._drag === 'fore');
    });
    
    fore.addEventListener('mouseover', event => fore.classList.toggle('over', this.canMove && event.target === fore));
    fore.addEventListener('mouseout', () => fore.classList.remove('over'));

    window.addEventListener('mousemove', (event: MouseEvent) => {
      if (fore.classList.contains('resizing')) {
        const rect = fore.getBoundingClientRect();
        const adjust = 5;
        fore.style.width = adjust + event.pageX - rect.x + 'px';
        fore.style.height = adjust + event.pageY - rect.y + 'px';
      }
      else if (this.canMove && this._drag === 'fore' && this._coords) {
        const x_pc = 100 * Math.max(0, event.pageX - this._coords.x) / window.innerWidth;
        const y_pc = 100 * Math.max(0, event.pageY - this._coords.y) / window.innerHeight;
        const x_css = `min(100vw - 100%, ${x_pc.toFixed(2)}vw)`;
        const y_css = `min(100vh - 100%, ${y_pc.toFixed(2)}vh)`;     
        fore.style.top = fore.style.left = '0';
        fore.style.transform = `translate(${x_css}, ${y_css})`;
      }
    });

    window.addEventListener('mouseup', () => {
      this._drag = null;
      fore.classList.remove('moving', 'resizing');
    });
    back.addEventListener('mouseup', event => {
      if (this._drag === 'back' && event.target === back) this.dismiss();
      this._drag = null;
      fore.classList.remove('moving', 'resizing');
    });

    fore.addEventListener('transitionend', (event: TransitionEvent) => {
      if (event.propertyName === 'transform') {
        if (back.classList.contains('open')) {
          fore.classList.add('ready');
        } 
        else this.resetOffscreenPosition(fore);
      }
    });
  }

  close(): void {
    this.removeAttribute('open');
  }

  open(): void {
    this.setAttribute('open', '');
  }

  wrap(selectorOrElem: string | Element): void {
    const target = typeof (selectorOrElem as Element).append === 'function' 
      ? selectorOrElem as Element
      : document.querySelector(selectorOrElem + '');
    this.appendChild(target);
  }

  confirm(): void {
    const doCheck = !!this.confirmCallback;
    const proceed = !doCheck || this.confirmCallback();
    if (doCheck) this.fire(proceed ? 'confirmaccept' : 'confirmreject');
    if (proceed) this.close();
  }

  dismiss(): void {
    const doCheck = !!this.dismissCallback;
    const proceed = !doCheck || this.dismissCallback();
    if (doCheck) this.fire(proceed ? 'dismissaccept' : 'dismissreject');
    if (proceed) this.close();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    switch (name) {
      case 'open':
        const back = this.root.querySelector('.back');
        const fore = back.querySelector('.fore') as HTMLElement;
        const doOpen = !!newValue || typeof newValue === 'string';
        fore.classList.remove('ready', 'moving');
        fore.style.transform = doOpen ? 'translate(-50%, -50%)' : fore.style.transform + ' translateY(-100vh)';
        fore.classList.toggle('resize', this.canResize);
        fore.classList.toggle('no-close', !this.canClose);
        back.classList.toggle('open', doOpen);
        if (doOpen) this.propagateSupportedStyles(back as HTMLElement);
        this.fire(doOpen ? 'open' : 'close');
        break;
      case 'style':
        if (newValue) {
          Popup.STYLE_KEYS
            .map(key => ({key, value: (this.style as any)[key]}))
            .filter(kvp => kvp.value)
            .forEach(kvp => this._styles[kvp.key] = kvp.value);
          this.removeAttribute('style');
        }
        break;
    }
  }

  connectedCallback() {
    const back = this.root.querySelector('.back');
    const fore = back.querySelector('.fore');
    if (back.classList.contains('open')) {
      fore.classList.add('ready');
    }
  }

  disconnectedCallback() {}

  private resetOffscreenPosition(fore: HTMLElement): void {
    fore.style.left = '50%';
    fore.style.top = '50%';
    fore.style.transform = 'translate(-50%, -100vh)';
    fore.style.width = '';
    fore.style.height = '';
  }

  /** Some relevant style properties are propagated */
  private propagateSupportedStyles(backing: HTMLElement) {
    
    // Backing
    ['backgroundColor'].forEach(prop => {
      (backing.style as any)[prop] = this._styles[prop];
    });

    // Fore
    const fore = backing.querySelector('.fore') as HTMLElement;
    [
      'borderTopLeftRadius',
      'borderTopRightRadius',
      'borderBottomRightRadius',
      'borderBottomLeftRadius',
      'boxShadow',
    ].forEach(prop => {
      (fore.style as any)[prop] = this._styles[prop];
    });
  }

  /** Emits an event from the specified node. */
  private fire<T>(event: string, detail?: T) {
    this.dispatchEvent(new CustomEvent(event, { detail }));
  }
}
