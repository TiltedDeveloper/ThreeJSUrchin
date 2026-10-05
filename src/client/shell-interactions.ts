import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Briefcase, createElement, Info, Mail, X, type IconNode } from 'lucide';

type SectionId = 'about' | 'work' | 'contact';

interface ShellSection {
    id: SectionId;
    label: string;
    icon: IconNode;
    text: string;
    attachmentDirection: THREE.Vector3;
}

interface Marker {
    button: HTMLButtonElement;
    localPosition: THREE.Vector3;
}

interface InteractionOptions {
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    canvas: HTMLCanvasElement;
    startingDistance: number;
}

function createSections(viewDirection: THREE.Vector3): ShellSection[] {
    const content = [
        { id: 'about' as const, label: 'About', icon: Info, text: 'Urchin Studios, an immersive production studio, exists at the intersections and transections of art, science, and technology.\n Founded in 2023 by Kyle Marais, the studio looks to leverage New Media technologies to tell stories in innovative and intuitive ways.' },
        { id: 'work' as const, label: 'Work', icon: Briefcase, text: 'Selected projects coming soon.' },
        { id: 'contact' as const, label: 'Contact', icon: Mail, text: 'Contact details coming soon.' },
    ];
    return content.map((section, index) => ({
        ...section,
        attachmentDirection: viewDirection.clone()
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), index * Math.PI * 2 / 3),
    }));
}

function iconElement(icon: IconNode) {
    return createElement(icon, {
        width: 20,
        height: 20,
        'stroke-width': 1.75,
        'aria-hidden': 'true',
        focusable: 'false',
    });
}

export function createShellInteractions({ camera, controls, canvas, startingDistance }: InteractionOptions) {
    const sections = createSections(camera.position.clone().sub(controls.target).normalize());
    const layer = document.createElement('div');
    layer.className = 'shell-markers';
    layer.setAttribute('role', 'group');
    layer.setAttribute('aria-label', 'Portfolio sections');

    const dialog = document.createElement('dialog');
    dialog.className = 'shell-dialog';
    dialog.id = 'shell-dialog';
    dialog.setAttribute('aria-labelledby', 'shell-dialog-title');
    dialog.setAttribute('aria-describedby', 'shell-dialog-text');

    const heading = document.createElement('div');
    heading.className = 'shell-dialog__heading';
    const title = document.createElement('h2');
    title.id = 'shell-dialog-title';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'shell-dialog__close';
    close.setAttribute('aria-label', 'Close dialog');
    close.title = 'Close dialog';
    close.append(iconElement(X));
    heading.append(title, close);
    const text = document.createElement('p');
    text.id = 'shell-dialog-text';
    dialog.append(heading, text);
    document.body.append(layer, dialog);

    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Interactive Urchin scene');
    let trigger: HTMLButtonElement | undefined;
    let controlsWereEnabled = true;
    let suspended = false;

    function resumeScene() {
        if (!suspended) return;
        suspended = false;
        controls.enabled = controlsWereEnabled;
        (trigger && !trigger.hidden ? trigger : canvas).focus({ preventScroll: true });
    }

    function closeDialog() {
        dialog.close();
        // Restore controls synchronously, before another marker can reopen the dialog.
        resumeScene();
    }

    function openDialog(section: ShellSection, button: HTMLButtonElement) {
        if (dialog.open || button.hidden) return;
        title.textContent = section.label;
        text.textContent = section.text;
        trigger = button;
        controlsWereEnabled = controls.enabled;
        suspended = true;
        controls.enabled = false;
        dialog.showModal();
        close.focus({ preventScroll: true });
    }

    close.addEventListener('click', closeDialog);
    dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeDialog();
    });
    dialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        const focusable = [...dialog.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
            .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
        }
    });
    dialog.addEventListener('close', () => {
        if (!dialog.open) resumeScene();
    });
    function isBackdrop(event: MouseEvent) {
        const rect = dialog.getBoundingClientRect();
        return event.target === dialog && (
            event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom
        );
    }
    let backdropPress = false;
    dialog.addEventListener('pointerdown', (event) => { backdropPress = isBackdrop(event); });
    dialog.addEventListener('pointercancel', () => { backdropPress = false; });
    dialog.addEventListener('click', (event) => {
        if (backdropPress && isBackdrop(event)) closeDialog();
        backdropPress = false;
    });

    function createButton(section: ShellSection) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'shell-marker';
        button.dataset.section = section.id;
        button.hidden = true;
        button.setAttribute('aria-label', section.label);
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-controls', dialog.id);
        const tooltip = document.createElement('span');
        tooltip.className = 'shell-marker__tooltip';
        tooltip.setAttribute('aria-hidden', 'true');
        tooltip.textContent = section.label;
        button.append(iconElement(section.icon), tooltip);

        let press: { id: number; x: number; y: number; dragged: boolean } | undefined;
        let allowClick = false;
        button.addEventListener('pointerdown', (event) => {
            allowClick = false;
            if (!event.isPrimary || event.button !== 0) {
                if (press) press.dragged = true;
                return;
            }
            press = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
            button.setPointerCapture(event.pointerId);
            event.stopPropagation();
        });
        function trackMovement(event: PointerEvent) {
            if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) {
                press.dragged = true;
            }
        }
        button.addEventListener('pointermove', trackMovement);
        button.addEventListener('pointerup', (event) => {
            trackMovement(event);
            const rect = button.getBoundingClientRect();
            allowClick = press?.id === event.pointerId && !press.dragged &&
                event.clientX >= rect.left && event.clientX <= rect.right &&
                event.clientY >= rect.top && event.clientY <= rect.bottom;
            press = undefined;
        });
        button.addEventListener('pointercancel', () => { press = undefined; allowClick = false; });
        button.addEventListener('click', (event) => {
            // Keyboard and assistive-technology clicks have no pointer click count.
            if (event.detail === 0 || allowClick) openDialog(section, button);
            allowClick = false;
        });
        layer.append(button);
        return button;
    }

    const raycaster = new THREE.Raycaster();
    const meshes: THREE.Mesh[] = [];
    const markers: Marker[] = [];
    const worldPosition = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const cameraPosition = new THREE.Vector3();
    const direction = new THREE.Vector3();
    let model: THREE.Group | undefined;
    let surfaceOffset = 0;

    function attachModel(object: THREE.Group) {
        model = object;
        object.updateWorldMatrix(true, true);
        object.traverse((child) => { if (child instanceof THREE.Mesh) meshes.push(child); });
        const bounds = new THREE.Box3().setFromObject(object);
        const center = bounds.getCenter(new THREE.Vector3());
        const diameter = bounds.getSize(new THREE.Vector3()).length();
        surfaceOffset = diameter * 0.002;

        for (const section of sections) {
            const outward = section.attachmentDirection;
            raycaster.set(center.clone().addScaledVector(outward, diameter), outward.clone().negate());
            raycaster.near = 0;
            raycaster.far = diameter * 2;
            const hit = raycaster.intersectObjects(meshes, false)[0];
            if (!hit?.face) {
                console.warn(`No shell surface found for ${section.label}.`);
                continue;
            }
            const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
            if (normal.dot(outward) < 0) normal.negate();
            markers.push({
                button: createButton(section),
                localPosition: object.worldToLocal(hit.point.clone().addScaledVector(normal, surfaceOffset)),
            });
        }
    }

    function setVisible(button: HTMLButtonElement, visible: boolean) {
        button.hidden = !visible;
        if (!visible && document.activeElement === button) canvas.focus({ preventScroll: true });
    }

    function update() {
        if (!model) return;
        const rect = canvas.getBoundingClientRect();
        const left = Math.max(0, rect.left);
        const top = Math.max(0, rect.top);
        const width = Math.max(0, Math.min(innerWidth, rect.right) - left);
        const height = Math.max(0, Math.min(innerHeight, rect.bottom) - top);
        Object.assign(layer.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });

        const opacity = THREE.MathUtils.clamp(3 - camera.position.distanceTo(controls.target) / startingDistance, 0, 1);
        model.updateWorldMatrix(true, true);
        camera.updateMatrixWorld();
        camera.getWorldPosition(cameraPosition);

        for (const { button, localPosition } of markers) {
            model.localToWorld(worldPosition.copy(localPosition));
            projected.copy(worldPosition).project(camera);
            const x = rect.left + (projected.x + 1) * rect.width / 2 - left;
            const y = rect.top + (1 - projected.y) * rect.height / 2 - top;
            let visible = opacity > 0 && projected.z >= -1 && projected.z <= 1 &&
                x >= 22 && x <= width - 22 && y >= 22 && y <= height - 22;
            if (visible) {
                direction.subVectors(worldPosition, cameraPosition);
                raycaster.set(cameraPosition, direction.clone().normalize());
                raycaster.far = direction.length() - surfaceOffset / 2;
                visible = raycaster.intersectObjects(meshes, false).length === 0;
            }
            setVisible(button, visible);
            if (visible) {
                button.style.left = `${x}px`;
                button.style.top = `${y}px`;
                button.style.opacity = String(opacity);
            }
        }
    }

    return { attachModel, update, get paused() { return dialog.open; } };
}
