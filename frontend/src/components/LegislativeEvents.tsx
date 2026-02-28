import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, FileText, ExternalLink } from 'lucide-react';
import { getEvents, OpenStatesEvent } from '../services/openstates';

interface LegislativeEventsProps {
  state: string;
  zipcode: string;
}

const LegislativeEvents: React.FC<LegislativeEventsProps> = ({ state, zipcode }) => {
  const [events, setEvents] = useState<OpenStatesEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'upcoming' | 'this_week' | 'this_month'>('upcoming');

  useEffect(() => {
    const loadEvents = async () => {
      if (!state) return;

      setLoading(true);
      try {
        const now = new Date();
        let startDate: string;
        let endDate: string;

        switch (timeFilter) {
          case 'this_week':
            startDate = now.toISOString().split('T')[0];
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            endDate = nextWeek.toISOString().split('T')[0];
            break;
          case 'this_month':
            startDate = now.toISOString().split('T')[0];
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
            endDate = nextMonth.toISOString().split('T')[0];
            break;
          default: // upcoming
            startDate = now.toISOString().split('T')[0];
            const futureDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // Next 90 days
            endDate = futureDate.toISOString().split('T')[0];
            break;
        }

        const eventData = await getEvents(state, {
          startDate,
          endDate,
          limit: 20
        });
        setEvents(eventData);
      } catch (error) {
        console.error('Error loading events:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [state, timeFilter]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isToday = (dateString: string) => {
    const today = new Date().toDateString();
    const eventDate = new Date(dateString).toDateString();
    return today === eventDate;
  };

  const isTomorrow = (dateString: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const eventDate = new Date(dateString).toDateString();
    return tomorrow.toDateString() === eventDate;
  };

  const getDateLabel = (dateString: string) => {
    if (isToday(dateString)) return 'Today';
    if (isTomorrow(dateString)) return 'Tomorrow';
    return formatDate(dateString);
  };

  if (loading) {
    return (
      <section className="events-section">
        <div className="section-header">
          <Calendar size={24} />
          <h2>Legislative Calendar</h2>
        </div>
        <div className="loading-message">
          <p>Loading upcoming events...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="events-section">
      <div className="section-header">
        <Calendar size={24} />
        <h2>Legislative Calendar</h2>
        <div className="time-filters">
          <button
            className={`filter-btn ${timeFilter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setTimeFilter('upcoming')}
          >
            Next 90 Days
          </button>
          <button
            className={`filter-btn ${timeFilter === 'this_week' ? 'active' : ''}`}
            onClick={() => setTimeFilter('this_week')}
          >
            This Week
          </button>
          <button
            className={`filter-btn ${timeFilter === 'this_month' ? 'active' : ''}`}
            onClick={() => setTimeFilter('this_month')}
          >
            This Month
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="no-events">
          <p>No upcoming legislative events scheduled for {state}</p>
        </div>
      ) : (
        <div className="events-list">
          {events.map((event) => (
            <div key={event.id} className="event-card">
              <div className="event-date">
                <div className="date-label">{getDateLabel(event.start_date)}</div>
                <div className="time-label">
                  <Clock size={14} />
                  {formatTime(event.start_date)}
                  {event.end_date && (
                    <span> - {formatTime(event.end_date)}</span>
                  )}
                </div>
              </div>

              <div className="event-content">
                <h3 className="event-name">{event.name}</h3>

                {event.description && (
                  <p className="event-description">{event.description}</p>
                )}

                <div className="event-meta">
                  {event.location && (
                    <div className="event-location">
                      <MapPin size={14} />
                      <span>{event.location.name || event.location.address || 'Location TBD'}</span>
                    </div>
                  )}

                  {event.participants && event.participants.length > 0 && (
                    <div className="event-participants">
                      <Users size={14} />
                      <span>{event.participants.length} participant{event.participants.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {event.agenda && event.agenda.length > 0 && (
                  <div className="event-agenda">
                    <h4><FileText size={14} /> Agenda ({event.agenda.length} items)</h4>
                    <div className="agenda-preview">
                      {event.agenda.slice(0, 3).map((item, index) => (
                        <div key={index} className="agenda-item">
                          {item.description || `Agenda Item ${item.order}`}
                          {item.bills && item.bills.length > 0 && (
                            <span className="bill-count">
                              ({item.bills.length} bill{item.bills.length > 1 ? 's' : ''})
                            </span>
                          )}
                        </div>
                      ))}
                      {event.agenda.length > 3 && (
                        <div className="more-agenda">
                          +{event.agenda.length - 3} more items
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {event.media && event.media.length > 0 && (
                  <div className="event-media">
                    {event.media.map((media, index) => (
                      <a
                        key={index}
                        href={media.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="media-link"
                      >
                        <ExternalLink size={14} />
                        {media.note || media.type || 'View Media'}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default LegislativeEvents;