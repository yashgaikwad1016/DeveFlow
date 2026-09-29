import { useState, useCallback, createContext, useContext } from 'react';
import Icon from './Icon';

// ── Toast System ──────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type = 'ok') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <Icon name={t.type === 'err' ? 'alert' : 'check'} />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ── Modal System ──────────────────────────────────────────────────────────────
const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null); // { content, wide }
  const [drawer, setDrawer] = useState(null);

  const openModal = useCallback((content, wide = false) => setModal({ content, wide }), []);
  const closeModal = useCallback(() => setModal(null), []);
  const openDrawer = useCallback((content) => setDrawer(content), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal, openDrawer, closeDrawer }}>
      {children}

      {/* Modal */}
      {modal && (
        <div className="modal" onClick={e => e.target.classList.contains('modal') && closeModal()}>
          <div className={`modal-box${modal.wide ? ' wide' : ''}`}>
            <button className="icon-btn close" onClick={closeModal}><Icon name="x" /></button>
            <div id="modalBody">{modal.content}</div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawer && (
        <div className="drawer" onClick={e => e.target.classList.contains('drawer') && closeDrawer()}>
          <div className="drawer-box">
            <button className="icon-btn close" onClick={closeDrawer}><Icon name="x" /></button>
            <div id="drawerBody">{drawer}</div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export const useModal = () => useContext(ModalContext);

// ── Confirm dialog ────────────────────────────────────────────────────────────
export function useConfirm() {
  const { openModal, closeModal } = useModal();
  return (title, text, okLabel = 'Delete') =>
    new Promise(resolve => {
      openModal(
        <div>
          <h2>{title}</h2>
          <p className="lead">{text}</p>
          <div className="form-actions">
            <button className="btn" onClick={() => { closeModal(); resolve(false); }}>Cancel</button>
            <button className="btn primary" style={{ background: 'var(--red)', boxShadow: 'none' }}
              onClick={() => { closeModal(); resolve(true); }}>{okLabel}</button>
          </div>
        </div>
      );
    });
}
