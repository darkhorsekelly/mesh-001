// ===============================================
// NavList - Navigation target list
// ===============================================
// Displays celestials grouped by system.
// Clicking a target emits CAMERA_SLEW to jump the viewport.

import type { NavTarget } from '../hooks/useSensors.js';
import { inputEvents } from '../events/inputEvents.js';

// -----------------------------------------------
// Styles
// -----------------------------------------------

const STYLES = {
    container: {
        marginTop: 16,
        borderTop: '1px solid #333',
        paddingTop: 12,
    },

    title: {
        fontSize: 11,
        color: '#666',
        marginBottom: 8,
        textTransform: 'uppercase' as const,
        letterSpacing: 1,
    },

    systemGroup: {
        marginBottom: 12,
    },

    systemHeader: {
        fontSize: 10,
        color: '#888',
        marginBottom: 4,
        paddingLeft: 4,
    },

    list: {
        listStyle: 'none',
        padding: 0,
        margin: 0,
    },

    item: {
        padding: '4px 8px',
        fontSize: 11,
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderLeft: '2px solid transparent',
    },

    itemHover: {
        background: '#111',
        borderLeftColor: '#444',
    },

    itemName: {
        color: '#fff',
    },

    itemType: {
        color: '#666',
        fontSize: 9,
        textTransform: 'uppercase' as const,
    },

    typeIcon: {
        marginRight: 6,
        fontSize: 10,
    },
};

// -----------------------------------------------
// Type icons (simple text for now)
// -----------------------------------------------

const TYPE_ICONS: Record<string, string> = {
    SOL: '★',
    PLANET: '●',
    MOON: '○',
    ASTEROID: '·',
    WORMHOLE: '◎',
};

// -----------------------------------------------
// Props
// -----------------------------------------------

interface NavListProps {
    celestialsBySystem: Record<string, NavTarget[]>;
}

// -----------------------------------------------
// Component
// -----------------------------------------------

export function NavList({ celestialsBySystem }: NavListProps) {
    // sort systems by name
    const systemIds = Object.keys(celestialsBySystem).sort();

    if (systemIds.length === 0) {
        return (
            <div style={STYLES.container}>
                <div style={STYLES.title}>NAV</div>
                <div style={{ fontSize: 11, color: '#666' }}>No targets</div>
            </div>
        );
    }

    return (
        <div style={STYLES.container} onClick={(e) => e.stopPropagation()}>
            <div style={STYLES.title}>NAV</div>
            
            {systemIds.map(systemId => {
                const targets = celestialsBySystem[systemId];
                if (!targets || targets.length === 0) return null;

                // sort targets: SOL first, then by type, then by name
                const sortedTargets = [...targets].sort((a, b) => {
                    const typeOrder: Record<string, number> = {
                        SOL: 0,
                        PLANET: 1,
                        MOON: 2,
                        ASTEROID: 3,
                        WORMHOLE: 4,
                    };
                    const orderA = typeOrder[a.type] ?? 99;
                    const orderB = typeOrder[b.type] ?? 99;
                    if (orderA !== orderB) return orderA - orderB;
                    return a.name.localeCompare(b.name);
                });

                return (
                    <div key={systemId} style={STYLES.systemGroup}>
                        <div style={STYLES.systemHeader}>{systemId}</div>
                        <ul style={STYLES.list}>
                            {sortedTargets.map(target => (
                                <NavListItem key={target.id} target={target} />
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}

// -----------------------------------------------
// NavListItem
// -----------------------------------------------

function NavListItem({ target }: { target: NavTarget }) {
    const handleClick = () => {
        inputEvents.cameraSlew(target.position, target.name, target.type);
    };

    const icon = TYPE_ICONS[target.type] || '?';

    return (
        <li
            style={STYLES.item}
            onClick={handleClick}
            onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, STYLES.itemHover);
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = '';
                e.currentTarget.style.borderLeftColor = 'transparent';
            }}
        >
            <span style={STYLES.itemName}>
                <span style={STYLES.typeIcon}>{icon}</span>
                {target.name}
            </span>
            <span style={STYLES.itemType}>{target.type}</span>
        </li>
    );
}
