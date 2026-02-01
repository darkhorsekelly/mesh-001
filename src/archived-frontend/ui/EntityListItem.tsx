// ===============================================
// EntityListItem - Single entity row in the navigator
// ===============================================
// Memoized for performance: only re-renders when props change
// Style: Windows 95 aesthetic - inverted colors when selected
// TODO: All Windows 95 styling should be centralized in a stylesheet
// Selection: emits to inputEvents bus (no callback props)

import { memo } from 'react';
import type { EntityViewModel } from '../hooks/useInput.js';
import { formatEntityType, formatId } from './DisplayUtils.js';
import { inputEvents } from '../events/inputEvents.js';

// -----------------------------------------------
// Props
// -----------------------------------------------

interface EntityListItemProps {
    viewModel: EntityViewModel;
}

// -----------------------------------------------
// Styles
// -----------------------------------------------

const STYLES = {
    base: {
        padding: '4px 6px',
        marginBottom: 1,
        fontSize: 11,
        fontFamily: 'monospace',
        cursor: 'pointer',
        border: '1px solid transparent',
        userSelect: 'none' as const,
    },
    
    // Default state (not selected)
    default: {
        background: 'transparent',
        color: '#fff',
        border: '1px solid #333',
    },
    
    // Selected state - inverted colors
    selected: {
        background: '#fff',
        color: '#000',
        border: '1px solid #fff',
    },
    
    // Not owned - dimmed
    notOwned: {
        color: '#666',
    },
    
    row: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    
    typeLabel: {
        fontWeight: 500,
    },
    
    idLabel: {
        fontSize: 10,
        opacity: 0.6,
    },
};

// -----------------------------------------------
// Component
// -----------------------------------------------

function EntityListItemComponent({ viewModel }: EntityListItemProps) {
    const { id, type, isSelected, isOwned } = viewModel;
    
    // Compute final style based on state
    const computedStyle = {
        ...STYLES.base,
        ...(isSelected ? STYLES.selected : STYLES.default),
        ...(!isOwned && !isSelected ? STYLES.notOwned : {}),
    };
    
    // ID label style adjusts for inverted colors
    const idLabelStyle = {
        ...STYLES.idLabel,
        color: isSelected ? '#333' : '#666',
    };
    
    // Emit to event bus - useInput subscribes and handles state
    // stopPropagation prevents sidebar deselect handler from firing
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        inputEvents.selectEntity(id);
    };
    
    return (
        <div
            style={computedStyle}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputEvents.selectEntity(id);
                }
            }}
        >
            <div style={STYLES.row}>
                <span style={STYLES.typeLabel}>
                    {formatEntityType(type)}
                </span>
                <span style={idLabelStyle}>
                    {formatId(id)}
                </span>
            </div>
        </div>
    );
}

// Memoize to prevent re-renders when parent updates unrelated state
export const EntityListItem = memo(EntityListItemComponent);
