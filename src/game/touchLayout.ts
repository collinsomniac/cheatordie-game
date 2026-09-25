const STORAGE_KEY = 'cheatordie.touch-layout.v1';

interface StoredPoint {
  x: number;
  y: number;
}

type StoredLayout = Record<string, StoredPoint>;

export class TouchLayoutEditor {
  private editing = false;
  private activePointer: number | null = null;
  private activeElement: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly toggle: HTMLButtonElement,
    private readonly resetButton: HTMLButtonElement,
  ) {
    this.applySaved();
    this.toggle.addEventListener('click', this.toggleEditing);
    this.resetButton.addEventListener('click', this.reset);
    this.root.addEventListener('pointerdown', this.onPointerDown, true);
    window.addEventListener('pointermove', this.onPointerMove, true);
    window.addEventListener('pointerup', this.onPointerUp, true);
    window.addEventListener('pointercancel', this.onPointerUp, true);
    this.root.addEventListener('click', this.blockEditedClicks, true);
  }

  private toggleEditing = (): void => {
    this.editing = !this.editing;
    document.body.classList.toggle('controls-editing', this.editing);
    this.toggle.textContent = this.editing ? 'LOCK HUD' : 'EDIT HUD';
    this.resetButton.classList.toggle('hidden', !this.editing);
    if (!this.editing) this.save();
  };

  private reset = (): void => {
    localStorage.removeItem(STORAGE_KEY);
    for (const element of this.elements()) {
      element.style.removeProperty('left');
      element.style.removeProperty('top');
      element.style.removeProperty('right');
      element.style.removeProperty('bottom');
      element.style.removeProperty('transform');
    }
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.editing) return;
    const element = (event.target as Element | null)?.closest<HTMLElement>('[data-layout-key]');
    if (!element) return;

    event.preventDefault();
    event.stopPropagation();
    this.activePointer = event.pointerId;
    this.activeElement = element;
    element.setPointerCapture?.(event.pointerId);
    element.classList.add('is-dragging');
    this.position(element, event.clientX, event.clientY);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.editing || this.activePointer !== event.pointerId || !this.activeElement) return;
    event.preventDefault();
    event.stopPropagation();
    this.position(this.activeElement, event.clientX, event.clientY);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.activePointer !== event.pointerId || !this.activeElement) return;
    event.preventDefault();
    event.stopPropagation();
    this.activeElement.classList.remove('is-dragging');
    this.activeElement = null;
    this.activePointer = null;
    this.save();
  };

  private blockEditedClicks = (event: MouseEvent): void => {
    if (!this.editing) return;
    if ((event.target as Element | null)?.closest('[data-layout-key]')) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  private position(element: HTMLElement, clientX: number, clientY: number): void {
    const vv = window.visualViewport;
    const width = vv?.width ?? window.innerWidth;
    const height = vv?.height ?? window.innerHeight;
    const halfW = Math.max(22, element.offsetWidth / 2);
    const halfH = Math.max(22, element.offsetHeight / 2);
    const x = Math.max(halfW + 4, Math.min(width - halfW - 4, clientX));
    const y = Math.max(halfH + 4, Math.min(height - halfH - 4, clientY));

    element.style.left = `${(x / width) * 100}%`;
    element.style.top = `${(y / height) * 100}%`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    element.style.transform = 'translate(-50%, -50%)';
  }

  private save(): void {
    const vv = window.visualViewport;
    const width = vv?.width ?? window.innerWidth;
    const height = vv?.height ?? window.innerHeight;
    const layout: StoredLayout = {};

    for (const element of this.elements()) {
      const rect = element.getBoundingClientRect();
      const key = element.dataset.layoutKey;
      if (!key) continue;
      layout[key] = {
        x: Math.max(0, Math.min(1, (rect.left + rect.width / 2) / width)),
        y: Math.max(0, Math.min(1, (rect.top + rect.height / 2) / height)),
      };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }

  private applySaved(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const layout = JSON.parse(raw) as StoredLayout;
      for (const element of this.elements()) {
        const key = element.dataset.layoutKey;
        if (!key || !layout[key]) continue;
        element.style.left = `${layout[key]!.x * 100}%`;
        element.style.top = `${layout[key]!.y * 100}%`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.transform = 'translate(-50%, -50%)';
      }
    } catch (error) {
      console.warn('Ignoring invalid saved touch layout.', error);
    }
  }

  private elements(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>('[data-layout-key]')];
  }
}
