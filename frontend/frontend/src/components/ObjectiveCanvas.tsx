import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Target,
  Link2,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Info,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { catalogDefinition, subcategoryMetadata, CatalogHole } from '../data/catalogDefinition';
import '../styles/ObjectiveCanvas.css';
import CanvasExpandedView from './CanvasExpandedView';
import { getHoleFetcher } from '../data/canvasFetchers';

interface Peg {
  id: string;
  userId: string;
  holeId: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  comment?: string;
  timestamp: string;
  directTarget?: string;
  indirectTargets?: Attribution[];
}

interface Attribution {
  targetId: string;
  targetType: 'member' | 'committee' | 'agency' | 'contractor';
  relationship: 'voted_yes' | 'voted_no' | 'sponsored' | 'opposed' | 'executed' | 'benefited';
  strength: number;
}

interface ObjectiveCanvasProps {
  zipcode: string;
  state: string;
}

const PreviewList: React.FC<{ fetcher: (o?: { limit?: number; offset?: number }) => Promise<any[]> }> = ({ fetcher }) => {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetcher({ limit: 3, offset: 0 });
        if (alive) setRows(data);
      } catch (_) {
        // ignore preview errors
      }
    })();
    return () => { alive = false; };
  }, [fetcher]);
  if (!rows.length) return null;
  return (
    <div className="hole-preview-list">
      {rows.map((r) => (
        <div key={r.id} className="hole-row">
          <div className="hole-row-main">
            <span className="hole-row-title">{r.title}</span>
            {r.subtitle && <span className="hole-row-sub">{r.subtitle}</span>}
          </div>
          <div className="hole-row-date">{r.date}</div>
        </div>
      ))}
    </div>
  );
};

const ObjectiveCanvas: React.FC<ObjectiveCanvasProps> = ({ zipcode, state }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('federal');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['federal.legislation', 'federal.members', 'federal.spending'])
  );
  const [selectedHole, setSelectedHole] = useState<CatalogHole | null>(null);
  const [expandedHole, setExpandedHole] = useState<CatalogHole | null>(null);
  const [pegs, setPegs] = useState<Peg[]>([]);
  const [showPegModal, setShowPegModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

  // Get catalog items with state-specific descriptions
  const [catalogHoles, setCatalogHoles] = useState<CatalogHole[]>([]);

  useEffect(() => {
    // Update state-specific descriptions
    const updatedCatalog = catalogDefinition.map(hole => {
      if (hole.category === 'state' && hole.description) {
        return {
          ...hole,
          description: hole.description.replace('${state}', state)
        };
      }
      return hole;
    });
    setCatalogHoles(updatedCatalog);
  }, [state]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handlePegHole = (hole: CatalogHole) => {
    setSelectedHole(hole);
    setShowPegModal(true);
  };

  const submitPeg = (sentiment: 'positive' | 'negative' | 'neutral', comment: string) => {
    if (!selectedHole) return;

    const newPeg: Peg = {
      id: `peg-${Date.now()}`,
      userId: 'current-user',
      holeId: selectedHole.id,
      sentiment,
      comment,
      timestamp: new Date().toISOString(),
      directTarget: selectedHole.route_key,
      indirectTargets: []
    };

    setPegs([...pegs, newPeg]);
    setShowPegModal(false);
    setSelectedHole(null);
  };

  // Filter catalog based on search and availability
  const getFilteredHoles = () => {
    let filtered = catalogHoles;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(hole =>
        hole.name.toLowerCase().includes(query) ||
        hole.description?.toLowerCase().includes(query) ||
        hole.source.toLowerCase().includes(query)
      );
    }

    if (showOnlyAvailable) {
      filtered = filtered.filter(hole => hole.dataAvailable);
    }

    return filtered;
  };

  // Group filtered holes by category and subcategory
  const groupedHoles = getFilteredHoles().reduce((acc, hole) => {
    const key = `${hole.category}.${hole.subcategory}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(hole);
    return acc;
  }, {} as { [key: string]: CatalogHole[] });

  const categoryLabels: { [key: string]: string } = {
    'federal': 'Federal Government',
    'state': `${state} State Government`,
    'local': 'Local Government',
    'hyperlocal': 'School Districts & Special Services'
  };

  // Count statistics
  const stats = {
    total: catalogHoles.length,
    available: catalogHoles.filter(h => h.dataAvailable).length,
    federal: catalogHoles.filter(h => h.category === 'federal').length,
    state: catalogHoles.filter(h => h.category === 'state').length,
    local: catalogHoles.filter(h => h.category === 'local').length,
    hyperlocal: catalogHoles.filter(h => h.category === 'hyperlocal').length
  };

  return (
    <div className="objective-canvas">
      <div className="canvas-header">
        <div>
          <h2>Objective Canvas Catalog</h2>
          <p>Browse {stats.total} government data points across all levels. Peg your opinions to create accountability ripples.</p>
        </div>
        <div className="canvas-stats">
          <div className="stat">
            <CheckCircle size={16} className="stat-icon available" />
            <span>{stats.available} Available</span>
          </div>
          <div className="stat">
            <Clock size={16} className="stat-icon pending" />
            <span>{stats.total - stats.available} Coming Soon</span>
          </div>
        </div>
      </div>

      <div className="canvas-controls">
        <input
          type="text"
          placeholder="Search catalog points..."
          className="canvas-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <label className="availability-filter">
          <input
            type="checkbox"
            checked={showOnlyAvailable}
            onChange={(e) => setShowOnlyAvailable(e.target.checked)}
          />
          <span>Show only available data</span>
        </label>
      </div>

      <div className="canvas-categories">
        {['federal', 'state', 'local', 'hyperlocal'].map(category => {
          const categoryHoles = catalogHoles.filter(h => h.category === category);
          const availableCount = categoryHoles.filter(h => h.dataAvailable).length;

          return (
            <button
              key={category}
              className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              <span className="tab-label">{categoryLabels[category]}</span>
              <span className="tab-count">
                {availableCount}/{categoryHoles.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="canvas-board">
        {Object.entries(groupedHoles)
          .filter(([key]) => key.startsWith(selectedCategory))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([groupKey, holes]) => {
            const [category, subcategory] = groupKey.split('.');
            const isExpanded = expandedCategories.has(groupKey);
            const pegCount = pegs.filter(p => holes.some(h => h.id === p.holeId)).length;
            const availableInGroup = holes.filter(h => h.dataAvailable).length;
            const metadata = subcategoryMetadata[subcategory];

            return (
              <div key={groupKey} className="board-section">
                <div
                  className="section-header"
                  onClick={() => toggleCategory(groupKey)}
                >
                  <div className="section-title">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <div className="section-info">
                      <h3>{metadata?.label || subcategory}</h3>
                      {metadata?.description && (
                        <p className="section-description">{metadata.description}</p>
                      )}
                    </div>
                    <div className="section-badges">
                      {availableInGroup > 0 && (
                        <span className="availability-badge">
                          {availableInGroup}/{holes.length} ready
                        </span>
                      )}
                      {pegCount > 0 && (
                        <span className="peg-count">{pegCount} pegs</span>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="holes-grid">
                    {holes.map(hole => {
                      const holePegs = pegs.filter(p => p.holeId === hole.id);
                      const sentiment = holePegs.reduce((acc, peg) => {
                        if (peg.sentiment === 'positive') acc.positive++;
                        else if (peg.sentiment === 'negative') acc.negative++;
                        else acc.neutral++;
                        return acc;
                      }, { positive: 0, negative: 0, neutral: 0 });

                      return (
                        <div
                          key={hole.id}
                          className={`catalog-hole ${hole.dataAvailable ? 'available' : 'unavailable'}`}
                          onClick={() => hole.dataAvailable && setExpandedHole(hole)}
                        >
                          <div className="hole-header">
                            <div className="hole-icon">{hole.icon()}</div>
                            <div className="hole-inline-left">
                              <h4>{hole.name}</h4>
                              {hole.description && (
                                <span className="hole-inline-sub">{hole.description}</span>
                              )}
                            </div>
                            <div className="hole-status">
                              {hole.dataAvailable ? (
                                <CheckCircle size={14} className="status-icon available" />
                              ) : (
                                <Clock size={14} className="status-icon pending" />
                              )}
                            </div>
                          </div>

                          <div className="hole-content">
                            {(() => {
                              const fetcher = getHoleFetcher(hole.id);
                              return fetcher ? <PreviewList fetcher={fetcher} /> : null;
                            })()}

                            <div className="hole-meta">
                              <span className="source">{hole.source}</span>
                              {hole.dataService && (
                                <span className="service" title="Data service">
                                  {hole.dataService}
                                </span>
                              )}
                            </div>

                            {holePegs.length > 0 && (
                              <div className="hole-sentiment">
                                {sentiment.positive > 0 && (
                                  <span className="sentiment positive">
                                    <ThumbsUp size={14} /> {sentiment.positive}
                                  </span>
                                )}
                                {sentiment.negative > 0 && (
                                  <span className="sentiment negative">
                                    <ThumbsDown size={14} /> {sentiment.negative}
                                  </span>
                                )}
                                {sentiment.neutral > 0 && (
                                  <span className="sentiment neutral">
                                    <MessageCircle size={14} /> {sentiment.neutral}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {hole.dataAvailable && (
                            <div
                              className="hole-action"
                              onClick={(e) => { e.stopPropagation(); handlePegHole(hole); }}
                            >
                              <Target size={16} />
                              <span>Peg Opinion</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        {Object.keys(groupedHoles).filter(key => key.startsWith(selectedCategory)).length === 0 && (
          <div className="empty-state">
            <AlertCircle size={24} />
            <p>No catalog items found matching your filters</p>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="clear-search">
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>

      {expandedHole && (() => {
        const fetcher = getHoleFetcher(expandedHole.id);
        if (!fetcher) return null;
        return (
          <CanvasExpandedView
            title={expandedHole.name}
            subtitle={expandedHole.description}
            fetchItems={fetcher}
            onClose={() => setExpandedHole(null)}
          />
        );
      })()}

      {showPegModal && selectedHole && (
        <div className="peg-modal-overlay" onClick={() => setShowPegModal(false)}>
          <div className="peg-modal" onClick={e => e.stopPropagation()}>
            <div className="peg-modal-header">
              <h3>Peg Your Opinion</h3>
              <button className="modal-close" onClick={() => setShowPegModal(false)}>×</button>
            </div>

            <div className="peg-modal-target">
              <div className="target-icon">{selectedHole.icon()}</div>
              <div>
                <p className="peg-target">{selectedHole.name}</p>
                <p className="peg-description">{selectedHole.description}</p>
              </div>
            </div>

            <div className="sentiment-buttons">
              <button
                className="sentiment-btn positive"
                onClick={() => submitPeg('positive', '')}
              >
                <ThumbsUp size={20} />
                <span>Support</span>
              </button>
              <button
                className="sentiment-btn negative"
                onClick={() => submitPeg('negative', '')}
              >
                <ThumbsDown size={20} />
                <span>Oppose</span>
              </button>
              <button
                className="sentiment-btn neutral"
                onClick={() => submitPeg('neutral', '')}
              >
                <MessageCircle size={20} />
                <span>Comment</span>
              </button>
            </div>

            <textarea
              placeholder="Add context to your peg (optional)..."
              className="peg-comment"
              rows={4}
            />

            <div className="attribution-preview">
              <h4><Link2 size={16} /> Attribution Ripple Effects</h4>
              <p>Your peg will create accountability connections:</p>
              <ul>
                <li><strong>Direct:</strong> This {selectedHole.subcategory} item</li>
                <li><strong>Indirect:</strong> Officials who voted or decided on this</li>
                <li><strong>Network:</strong> Related decisions by the same officials</li>
                <li><strong>Temporal:</strong> Historical pattern analysis</li>
              </ul>
            </div>

            <div className="modal-metadata">
              <div className="metadata-item">
                <Info size={14} />
                <span>Source: {selectedHole.source}</span>
              </div>
              {selectedHole.dataService && (
                <div className="metadata-item">
                  <CheckCircle size={14} />
                  <span>Live data via {selectedHole.dataService}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ObjectiveCanvas;