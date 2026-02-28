import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CanvasItem } from '../data/canvasFetchers';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  fetchItems: (opts?: { limit?: number; offset?: number }) => Promise<CanvasItem[]>;
}

const CanvasExpandedView: React.FC<Props> = ({ title, subtitle, onClose, fetchItems }) => {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await fetchItems({ limit: 25, offset: 0 });
        if (isMounted) {
          setItems(data);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [fetchItems]);

  return (
    <div className="peg-modal-overlay" onClick={onClose}>
      <div className="peg-modal" onClick={e => e.stopPropagation()}>
        <div className="peg-modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {subtitle && (
          <div className="peg-modal-target" style={{ alignItems: 'center' }}>
            <div>
              <p className="peg-description">{subtitle}</p>
            </div>
          </div>
        )}

        <div style={{ padding: '12px 16px' }}>
          {loading ? (
            <p>Loading…</p>
          ) : (
            <div className="hole-preview-list">
              {items.map(item => (
                <div key={item.id} className="hole-row">
                  <div className="hole-row-main">
                    <span className="hole-row-title">{item.title}</span>
                    {item.subtitle && <span className="hole-row-sub">{item.subtitle}</span>}
                  </div>
                  <div className="hole-row-date">{item.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CanvasExpandedView;


