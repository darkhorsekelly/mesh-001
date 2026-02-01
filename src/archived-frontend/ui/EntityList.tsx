// ===============================================
// EntityList - Entity navigator panel
// ===============================================
// Displays a scrollable list of entities
// Dumb component: receives view models, selection emits to event bus

import type { EntityViewModel } from '../hooks/useInput.js';
import { EntityListItem } from './EntityListItem.js';

// -----------------------------------------------
// Props
// -----------------------------------------------

interface EntityListProps {
    entities: EntityViewModel[];
    title?: string;
}

// -----------------------------------------------
// Styles
// -----------------------------------------------

const STYLES = {
    container: {
        marginTop: 16,
    },
    
    header: {
        fontSize: 11,
        color: '#666',
        marginBottom: 8,
        fontFamily: 'monospace',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    },
    
    list: {
        maxHeight: 200,
        overflow: 'auto' as const,
    },
    
    empty: {
        fontSize: 11,
        color: '#444',
        fontStyle: 'italic' as const,
        padding: '8px 0',
    },
};

// -----------------------------------------------
// Component
// -----------------------------------------------

export function EntityList({ entities, title = 'Entities' }: EntityListProps) {
    // stopPropagation prevents sidebar deselect handler from firing
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };
    
    if (entities.length === 0) {
        return (
            <div style={STYLES.container} onClick={handleClick}>
                <div style={STYLES.header}>{title}</div>
                <div style={STYLES.empty}>No entities in range</div>
            </div>
        );
    }
    
    return (
        <div style={STYLES.container} onClick={handleClick}>
            <div style={STYLES.header}>
                {title} ({entities.length})
            </div>
            <div style={STYLES.list}>
                {entities.map((vm) => (
                    <EntityListItem
                        key={vm.id}
                        viewModel={vm}
                    />
                ))}
            </div>
        </div>
    );
}
