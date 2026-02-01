// ===============================================
// useSensors - Sensor data hook (Used for Dev and Debug)
// ===============================================
// Filters GameState.celestials and GameState.entities based on sensor range.
// For now, returns ALL celestials as "Known Universe" (no range filtering) - this will be changed in the future.

import { useMemo } from 'react';
import type { GameState } from '../../engine/state-types/state-types.js';
import type { CelestialBody } from '../../engine/primitive-types/semantic/celestial/celestial-types.js';
import { getCelestialPosition, isWormhole } from '../../engine/primitive-types/semantic/celestial/celestial-types.js';
import type { Vector2FP } from '../../engine/primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Nav Target Interface
// -----------------------------------------------
// Simplified view model for navigation UI.

export interface NavTarget {
    id: string;
    name: string;
    type: string;
    position: Vector2FP;
    systemId?: string;
}

// -----------------------------------------------
// Hook
// -----------------------------------------------

export function useSensors(gameState: GameState | null) {
    // convert celestials to nav targets
    const celestialTargets = useMemo((): NavTarget[] => {
        if (!gameState) return [];

        return gameState.celestials.map((celestial): NavTarget => {
            // handle wormhole's dual-position case (use first endpoint)
            const position = getCelestialPosition(celestial);
            
            // extract system ID if available
            let systemId: string | undefined;
            if (celestial.type === 'SOL') {
                systemId = celestial.systemId;
            } else if (celestial.type === 'PLANET') {
                // find parent sol's system
                const parentSol = gameState.celestials.find(
                    c => c.type === 'SOL' && c.id === celestial.parentSolId
                );
                if (parentSol && parentSol.type === 'SOL') {
                    systemId = parentSol.systemId;
                }
            } else if (celestial.type === 'WORMHOLE') {
                // wormholes connect two systems
                systemId = celestial.systemIds[0];
            }

            return {
                id: celestial.id,
                name: celestial.name,
                type: celestial.type,
                position,
                systemId,
            };
        });
    }, [gameState]);

    // group by type for organized display
    const celestialsByType = useMemo(() => {
        const groups: Record<string, NavTarget[]> = {};
        
        for (const target of celestialTargets) {
            const key = target.type;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key]!.push(target);
        }

        return groups;
    }, [celestialTargets]);

    // group by system for organized display
    const celestialsBySystem = useMemo(() => {
        const groups: Record<string, NavTarget[]> = {};
        
        for (const target of celestialTargets) {
            const systemKey = target.systemId || 'unknown';
            if (!groups[systemKey]) {
                groups[systemKey] = [];
            }
            groups[systemKey]!.push(target);
        }

        return groups;
    }, [celestialTargets]);

    return {
        // all celestials as nav targets
        celestialTargets,

        // grouped by celestial type
        celestialsByType,

        // grouped by star system
        celestialsBySystem,

        // total count
        totalCelestials: celestialTargets.length,
    };
}
