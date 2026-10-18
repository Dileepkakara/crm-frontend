import { useId, useState } from 'react'
import './ClientSearchSelect.css'

function clientLabel(client) {
  return client.company || client.name || ''
}

export default function ClientSearchSelect({ clients, selectedId, query, onQueryChange, onSelect }) {
  const inputId = useId()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const selectedClient = clients.find((client) => client.id === selectedId)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matches = clients.filter((client) =>
    `${client.name || ''} ${client.company || ''}`.toLocaleLowerCase().includes(normalizedQuery))

  function choose(client) {
    onSelect(client)
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) => Math.min(current + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) => matches.length ? Math.max(current - 1, 0) : -1)
    } else if (event.key === 'Enter' && open && matches.length) {
      event.preventDefault()
      choose(matches[Math.max(activeIndex, 0)])
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return <div className="client-search-field form-field" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpen(false)
      setActiveIndex(-1)
    }
  }}>
    <label htmlFor={inputId}>Select client</label>
    <div className="client-search-control">
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
        autoComplete="off"
        placeholder="Search clients by name or company"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onQueryChange(event.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onKeyDown={handleKeyDown}
      />
      {(query || selectedClient) && <button
        className="client-search-clear"
        type="button"
        aria-label="Clear client selection"
        onClick={() => {
          onQueryChange('')
          setOpen(false)
          setActiveIndex(-1)
        }}
      >×</button>}
      {open && <div className="client-search-options" id={listId} role="listbox">
        {matches.length ? matches.map((client, index) => <div
          id={`${listId}-option-${index}`}
          className={`client-search-option${index === activeIndex ? ' is-active' : ''}${client.id === selectedId ? ' is-selected' : ''}`}
          key={client.id}
          role="option"
          aria-selected={client.id === selectedId}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(client)}
        >
          <span>{clientLabel(client)}</span>
          {client.company && client.name && client.company !== client.name && <small>{client.name}</small>}
        </div>) : <div className="client-search-empty" role="status">
          {normalizedQuery
            ? 'No matching clients found. Enter new client details in the billing fields below; this will not create a client record.'
            : 'No clients available.'}
        </div>}
      </div>}
    </div>
  </div>
}
