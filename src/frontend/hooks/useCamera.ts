// ===============================================
// useCamera - Camera state management
// ===============================================
// manages camera position (offset) and zoom level for the telescope viewport.

import { useState, useCallback, useMemo } from 'react';
import { ZOOM_LEVELS, DEFAULT_ZOOM_INDEX, getZoomByIndex, FP_SCALE, type ZoomLevel } from '../utils/fpConvert.js';
import type { Vector2FP } from '../../engine/primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Types
// -----------------------------------------------

export interface CameraState {
    // center of view in world FP coordinates
    offset: Vector2FP;
    // current zoom level index
    zoomIndex: number;
    // computed zoom scale
    zoom: number;
    // zoom level metadata
    zoomLevel: ZoomLevel;
}

export interface UseCameraReturn {
    camera: CameraState;
    // slew camera to a world position
    slewTo: (position: Vector2FP) => void;
    // pan camera by screen delta
    pan: (dx: number, dy: number) => void;
    // zoom in (increase index)
    zoomIn: () => void;
    // zoom out (decrease index)
    zoomOut: () => void;
    // set specific zoom level
    setZoomIndex: (index: number) => void;
}

// -----------------------------------------------
// Hook
// -----------------------------------------------

export function useCamera(initialOffset?: Vector2FP): UseCameraReturn {
    const [offset, setOffset] = useState<Vector2FP>(initialOffset ?? { x: 0, y: 0 });
    const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);

    const zoomLevel = useMemo(() => getZoomByIndex(zoomIndex), [zoomIndex]);
    const zoom = zoomLevel.scale;

    const camera: CameraState = useMemo(() => ({
        offset,
        zoomIndex,
        zoom,
        zoomLevel,
    }), [offset, zoomIndex, zoom, zoomLevel]);

    // slew directly to a world position
    const slewTo = useCallback((position: Vector2FP) => {
        setOffset({ x: position.x, y: position.y });
    }, []);

    // pan by screen pixels: offset is in FP, so delta = (pixels / zoom) * FP_SCALE
    const pan = useCallback((dx: number, dy: number) => {
        const scale = zoom > 0 ? FP_SCALE / zoom : 0;
        setOffset(prev => ({
            x: prev.x - Math.round(dx * scale),
            y: prev.y - Math.round(dy * scale),
        }));
    }, [zoom]);

    // zoom in (higher index = closer)
    const zoomIn = useCallback(() => {
        setZoomIndex(prev => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
    }, []);

    // zoom out (lower index = farther)
    const zoomOut = useCallback(() => {
        setZoomIndex(prev => Math.max(prev - 1, 0));
    }, []);

    // set specific zoom level
    const setZoom = useCallback((index: number) => {
        const clamped = Math.max(0, Math.min(index, ZOOM_LEVELS.length - 1));
        setZoomIndex(clamped);
    }, []);

    return {
        camera,
        slewTo,
        pan,
        zoomIn,
        zoomOut,
        setZoomIndex: setZoom,
    };
}
