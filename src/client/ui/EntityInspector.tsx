// ===============================================
// EntityInspector - Selected entity details panel
// ===============================================
// Shows technical data for the currently focused entity
// Only renders when an entity is selected

import type { Entity } from '../../engine/primitive-types/semantic/entity/entity-types.js';
import {
    formatEntityType,
    formatId,
    formatPosition,
    formatVelocity,
    formatHeading,
    formatFuel,
    formatSpeed,
} from './DisplayUtils.js';

// -----------------------------------------------
// Props
// -----------------------------------------------

interface EntityInspectorProps {
    entity: Entity | null;
}

// -----------------------------------------------
// Styles
// -----------------------------------------------

const STYLES = {
    container: {
        marginTop: 16,
        padding: 8,
        border: '1px solid #333',
        background: '#111',
    },
    
    header: {
        fontSize: 11,
        color: '#666',
        marginBottom: 8,
        fontFamily: 'monospace',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    },
    
    title: {
        fontSize: 13,
        color: '#fff',
        fontFamily: 'monospace',
        marginBottom: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    
    row: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 11,
        fontFamily: 'monospace',
        marginBottom: 4,
        color: '#888',
    },
    
    label: {
        color: '#666',
    },
    
    value: {
        color: '#fff',
        textAlign: 'right' as const,
    },
    
    divider: {
        height: 1,
        background: '#333',
        margin: '8px 0',
    },
    
    empty: {
        fontSize: 11,
        color: '#444',
        fontStyle: 'italic' as const,
        padding: '8px 0',
    },
    
    zoomBadge: {
        fontSize: 9,
        padding: '2px 4px',
        background: '#333',
        color: '#888',
    },
};

// -----------------------------------------------
// Component
// -----------------------------------------------

export function EntityInspector({ entity }: EntityInspectorProps) {
    // stopPropagation prevents sidebar deselect handler from firing
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };
    
    if (!entity) {
        return (
            <div style={STYLES.container} onClick={handleClick}>
                <div style={STYLES.header}>Inspector</div>
                <div style={STYLES.empty}>No entity selected</div>
            </div>
        );
    }
    
    return (
        <div style={STYLES.container} onClick={handleClick}>
            <div style={STYLES.header}>Inspector</div>
            
            {/* Entity identity */}
            <div style={STYLES.title}>
                <span>{formatEntityType(entity.type)}</span>
                <span style={STYLES.zoomBadge}>{entity.zoomState}</span>
            </div>
            
            <div style={STYLES.row}>
                <span style={STYLES.label}>ID</span>
                <span style={STYLES.value}>{formatId(entity.id, 12)}</span>
            </div>
            
            <div style={STYLES.divider} />
            
            {/* Position and motion */}
            <div style={STYLES.row}>
                <span style={STYLES.label}>Position</span>
                <span style={STYLES.value}>
                    {formatPosition(entity.position.x, entity.position.y)}
                </span>
            </div>
            
            <div style={STYLES.row}>
                <span style={STYLES.label}>Velocity</span>
                <span style={STYLES.value}>
                    {formatVelocity(entity.velocity.x, entity.velocity.y)}
                </span>
            </div>
            
            <div style={STYLES.row}>
                <span style={STYLES.label}>Speed</span>
                <span style={STYLES.value}>
                    {formatSpeed(entity.velocity.x, entity.velocity.y)}
                </span>
            </div>
            
            <div style={STYLES.divider} />
            
            {/* Ship-specific stats */}
            <div style={STYLES.row}>
                <span style={STYLES.label}>Heading</span>
                <span style={STYLES.value}>{formatHeading(entity.heading)}</span>
            </div>
            
            <div style={STYLES.row}>
                <span style={STYLES.label}>Fuel</span>
                <span style={STYLES.value}>{formatFuel(entity.fuel)}</span>
            </div>
        </div>
    );
}
