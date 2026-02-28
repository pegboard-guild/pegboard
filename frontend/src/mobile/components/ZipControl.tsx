import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { saveZipcode } from '../../utils';

interface ZipControlProps {
  zipcode: string;
  onChange?: (z: string) => void;
}

const ZipControl: React.FC<ZipControlProps> = ({ zipcode, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(zipcode || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(zipcode || '');
  }, [zipcode]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const cleaned = (value || '').trim();
    if (!/^\d{5}$/.test(cleaned)) {
      setEditing(false);
      setValue(zipcode || '');
      return;
    }
    saveZipcode(cleaned);
    onChange?.(cleaned);
    window.location.reload();
  };

  return (
    editing ? (
      <div className="m-zip-edit">
        <MapPin size={14} />
        <input
          ref={inputRef}
          className="m-zip-input"
          inputMode="numeric"
          pattern="\\d{5}"
          maxLength={5}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, '').slice(0,5))}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setEditing(false); setValue(zipcode || ''); }
          }}
          aria-label="ZIP code"
        />
      </div>
    ) : (
      <button className="m-zip" onClick={() => setEditing(true)} title="Change ZIP">
        <MapPin size={14} /> {zipcode || 'ZIP'}
      </button>
    )
  );
};

export default ZipControl;


