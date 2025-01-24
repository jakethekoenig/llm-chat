// chat-components/NewMessage.tsx
import React, { useState, useRef, useEffect } from 'react';

interface NewMessageProps {
  onSubmit: (message: string, options: { model: string; temperature: number; getCompletion: boolean }) => AsyncIterable<string>;
  initialModel?: string;
  initialTemperature?: number;
}

const NewMessage: React.FC<NewMessageProps> = ({ 
  onSubmit, 
  initialModel = 'gpt-4',
  initialTemperature = 0.7 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [model, setModel] = useState(initialModel);
  const [temperature, setTemperature] = useState(initialTemperature);
  const [showSendOptions, setShowSendOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSendOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const models = ['gpt-4', 'gpt-3.5-turbo'];
  const temperatures = Array.from({ length: 11 }, (_, i) => i / 10);

  const handleSubmit = async (getCompletion: boolean = true) => {
    if (inputValue.trim() === '') return;
    setLoading(true);
    setStreamingContent('');
    try {
      const iterator = onSubmit(inputValue, { model, temperature, getCompletion });
      for await (const chunk of iterator) {
        setStreamingContent(prev => prev + chunk);
      }
    } catch (error) {
      console.error('Error submitting message:', error);
      setStreamingContent('Error submitting message.');
    } finally {
      setLoading(false);
      setInputValue('');
      setShowSendOptions(false);
    }
  };

  return (
    <div className="new-message-container" style={{ 
      marginTop: '16px',
      padding: '20px',
      borderRadius: '8px',
      backgroundColor: '#f8f9fa',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div className="message-controls" style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '16px',
        gap: '12px'
      }}>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          aria-label="model"
          style={{
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}
        >
          {models.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          aria-label="temperature"
          style={{
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}
        >
          {temperatures.map(t => (
            <option key={t} value={t}>{t.toFixed(1)}</option>
          ))}
        </select>
      </div>
      
      <div className="input-container" style={{
        display: 'flex',
        gap: '8px',
        position: 'relative'
      }}>
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type your message..."
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            resize: 'vertical',
            minHeight: '80px'
          }}
          disabled={loading}
        />
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button 
            onClick={() => handleSubmit(true)} 
            disabled={loading}
            onContextMenu={(e) => {
              e.preventDefault();
              setShowSendOptions(!showSendOptions);
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              height: '100%'
            }}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
          {showSendOptions && (
            <div 
              ref={dropdownRef}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: 1000
              }}
            >
              <button
                onClick={() => handleSubmit(false)}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                Send without completion
              </button>
            </div>
          )}
        </div>
      </div>
      
      {streamingContent && (
        <div style={{ 
          marginTop: '16px',
          padding: '12px',
          backgroundColor: 'white',
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          {streamingContent}
        </div>
      )}
    </div>
  );
};

export default NewMessage;