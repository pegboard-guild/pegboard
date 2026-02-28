import React, { useState, useEffect } from 'react';
import { Building2, Users, ChevronRight } from 'lucide-react';
import { getCommittees, OpenStatesCommittee } from '../services/openstates';

interface CommitteesSectionProps {
  state: string;
  zipcode: string;
}

const CommitteesSection: React.FC<CommitteesSectionProps> = ({ state, zipcode }) => {
  const [committees, setCommittees] = useState<OpenStatesCommittee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCommittee, setExpandedCommittee] = useState<string | null>(null);

  useEffect(() => {
    const loadCommittees = async () => {
      if (!state) return;

      setLoading(true);
      try {
        const committeeData = await getCommittees(state);
        setCommittees(committeeData.slice(0, 12)); // Show top 12 committees
      } catch (error) {
        console.error('Error loading committees:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCommittees();
  }, [state]);

  const toggleCommittee = (committeeId: string) => {
    setExpandedCommittee(prev => prev === committeeId ? null : committeeId);
  };

  const getChamberLabel = (chamber: 'upper' | 'lower') => {
    return chamber === 'upper' ? 'Senate' : 'House';
  };

  const getChamberColor = (chamber: 'upper' | 'lower') => {
    return chamber === 'upper' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  if (loading) {
    return (
      <section className="committees-section">
        <div className="section-header">
          <Building2 size={24} />
          <h2>Legislative Committees</h2>
        </div>
        <div className="loading-message">
          <p>Loading committees...</p>
        </div>
      </section>
    );
  }

  if (committees.length === 0) {
    return (
      <section className="committees-section">
        <div className="section-header">
          <Building2 size={24} />
          <h2>Legislative Committees</h2>
        </div>
        <p className="no-data">No committee data available for {state}</p>
      </section>
    );
  }

  return (
    <section className="committees-section">
      <div className="section-header">
        <Building2 size={24} />
        <h2>Legislative Committees</h2>
        <span className="count-badge">{committees.length}</span>
      </div>

      <div className="committees-grid">
        {committees.map((committee) => (
          <div key={committee.id} className="committee-card">
            <div
              className="committee-header"
              onClick={() => toggleCommittee(committee.id)}
            >
              <div className="committee-info">
                <h3 className="committee-name">{committee.name}</h3>
                <div className="committee-meta">
                  <span className={`chamber-badge ${getChamberColor(committee.chamber)}`}>
                    {getChamberLabel(committee.chamber)}
                  </span>
                  {committee.classification && (
                    <span className="classification-badge">
                      {committee.classification}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight
                size={16}
                className={`chevron ${expandedCommittee === committee.id ? 'expanded' : ''}`}
              />
            </div>

            {expandedCommittee === committee.id && (
              <div className="committee-details">
                {committee.parent && (
                  <div className="parent-committee">
                    <strong>Parent Committee:</strong> {committee.parent.name}
                  </div>
                )}

                {committee.memberships && committee.memberships.length > 0 && (
                  <div className="committee-members">
                    <h4><Users size={16} /> Members ({committee.memberships.length})</h4>
                    <div className="members-list">
                      {committee.memberships.slice(0, 5).map((membership, index) => (
                        <div key={index} className="member-item">
                          <span className="member-name">{membership.person.name}</span>
                          <span className="member-role">{membership.role}</span>
                        </div>
                      ))}
                      {committee.memberships.length > 5 && (
                        <div className="more-members">
                          +{committee.memberships.length - 5} more members
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default CommitteesSection;