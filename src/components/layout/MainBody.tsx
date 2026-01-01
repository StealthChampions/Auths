/**
 * Main Body Component | 主体内容组件
 *
 * Displays account list, search bar, and add account functionality.
 * Handles account filtering, sorting, and smart filter based on current site.
 *
 * 显示账户列表、搜索栏和添加账户功能。
 * 处理账户过滤、排序和基于当前网站的智能过滤。
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAccounts, useStyle, useNotification, useMenu } from '@/store';
import { getSiteName, getMatchedEntriesHash } from '@/utils';
import { useI18n } from '@/i18n';
import EntryComponent from '@/components/features/accounts/EntryComponent';
import AddAccountForm from '@/components/features/accounts/AddAccountForm';
import AddMethodSelector from '@/components/features/accounts/AddMethodSelector';
import EditAccountModal from '@/components/features/accounts/EditAccountModal';

// SVG Icons | SVG 图标
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
  </svg>
);

const KeyIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 10h-8.35A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H13v2h2v-2h2v2h2v-2h2v-4zM7 15c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z" />
  </svg>
);

// Use OTPEntryInterface from global declarations
declare global {
  interface OTPEntryInterface {
    hash: string;
    issuer: string;
    account: string;
    code: string;
    period: number;
    pinned: boolean;
    type: number;
    counter: number;
    digits: number;
    secret: string | null;
    algorithm: number;
    icon?: string;
    folder?: string;
  }
}

export default function MainBody() {
  const { entries, filter, showSearch, dispatch } = useAccounts();
  const { style, dispatch: styleDispatch } = useStyle();
  const { dispatch: notificationDispatch } = useNotification();
  const { menu } = useMenu();
  const { t } = useI18n();
  const [searchText, setSearchText] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<OTPEntryInterface | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [matchedHashes, setMatchedHashes] = useState<string[]>([]);

  useEffect(() => {
    const checkSmartFilter = async () => {
      if (menu.smartFilter) {
        const siteName = await getSiteName();
        if (siteName[0] || siteName[1] || siteName[2]) {
          const hashes = getMatchedEntriesHash(siteName, entries || []);
          if (hashes) {
            setMatchedHashes(hashes);
            return;
          }
        }
      }
      setMatchedHashes([]);
    };
    checkSmartFilter();
  }, [menu.smartFilter, entries]);

  const filteredEntries = entries?.filter((entry: OTPEntryInterface) => {
    // Smart Filter
    if (menu.smartFilter && matchedHashes.length > 0 && searchText === '' && selectedFolder === 'all') {
      return matchedHashes.includes(entry.hash);
    }

    // First apply search filter
    const matchesSearch = () => {
      if (searchText === '') return true;
      const search = searchText.toLowerCase();
      const issuer = (entry.issuer || '').toLowerCase();
      const account = (entry.account || '').toLowerCase();
      return issuer.includes(search) || account.includes(search);
    };

    // Then apply folder filter
    const matchesFolder = () => {
      if (selectedFolder === 'all') return true;
      if (selectedFolder === 'uncategorized') return !entry.folder;
      return entry.folder === selectedFolder;
    };

    return matchesSearch() && matchesFolder();
  }) || [];

  // Sort entries: pinned first, then by original order
  const sortedEntries = [...filteredEntries].sort((a: OTPEntryInterface, b: OTPEntryInterface) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const folders = Array.from(new Set(entries?.map((e: OTPEntryInterface) => e.folder).filter(Boolean))) as string[];

  const handleClearFilter = () => {
    dispatch({ type: 'stopFilter' });
    if (entries?.length >= 10) {
      dispatch({ type: 'showSearch' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = Array.from(
      container.querySelectorAll('.entry:not(.filtered):not(.not-searched)')
    );
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        const nextIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
        (focusableElements[nextIndex] as HTMLElement)?.focus();
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        (focusableElements[prevIndex] as HTMLElement)?.focus();
        break;
      case '/':
        e.preventDefault();
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        searchInput?.focus();
        break;
    }
  };

  const getTabindex = (entry: OTPEntryInterface) => {
    const firstVisibleEntry = filteredEntries[0];
    return entry === firstVisibleEntry ? 0 : -1;
  };

  const handleAddAccountSuccess = () => {
    setShowMethodSelector(false);
    setShowAddForm(false);
  };

  const handleEditEntry = (entry: OTPEntryInterface) => {
    setEditingEntry(entry);
    setShowEditModal(true);
  };

  const handleEditClose = () => {
    setShowEditModal(false);
    setEditingEntry(null);
  };

  const handleEditSave = () => {
    setShowEditModal(false);
    setEditingEntry(null);
  };

  // Drag and Drop State and Handlers
  const [draggedEntryHash, setDraggedEntryHash] = useState<string | null>(null);
  const [dragOverEntryHash, setDragOverEntryHash] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, hash: string) => {
    setDraggedEntryHash(hash);
    e.dataTransfer.effectAllowed = 'move';
    // Add a small delay to allow the ghost image to be created
    setTimeout(() => {
      const el = document.querySelector(`[data-hash="${hash}"]`);
      if (el) el.classList.add('dragging');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedEntryHash(null);
    setDragOverEntryHash(null);
    document.querySelectorAll('.entry.dragging').forEach(el => el.classList.remove('dragging'));
  };

  const handleDragOver = (e: React.DragEvent, hash: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedEntryHash && draggedEntryHash !== hash) {
      setDragOverEntryHash(hash);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Optional: handle leave logic if needed
  };

  const handleDrop = (e: React.DragEvent, targetHash: string) => {
    e.preventDefault();
    if (draggedEntryHash && draggedEntryHash !== targetHash) {
      dispatch({
        type: 'reorderEntry',
        payload: { fromHash: draggedEntryHash, toHash: targetHash }
      });
    }
    setDraggedEntryHash(null);
    setDragOverEntryHash(null);
    document.querySelectorAll('.entry.dragging').forEach(el => el.classList.remove('dragging'));
  };







  return (
    <>
      {/* Search Bar */}
      <div className="search-bar">
        <div className="search-container">
          <span className="search-icon">
            <SearchIcon />
          </span>
          <input
            id="searchInput"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('search_accounts')}
            className="search-input"
          />
          {searchText && (
            <button
              className="clear-search"
              onClick={() => setSearchText('')}
              title={t('clear')}
              aria-label={t('clear')}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {/* Folder Tabs */}
      {entries && entries.length > 0 && (
        <div className="folder-tabs-container">
          <div className="folder-tabs">

            {folders.map(folder => (
              <button
                key={folder}
                className={`folder-tab ${selectedFolder === folder ? 'active' : ''}`}
                onClick={() => setSelectedFolder(folder)}
              >
                {folder}
              </button>
            ))}
            {entries.some((e: OTPEntryInterface) => !e.folder) && folders.length > 0 && (
              <button
                className={`folder-tab ${selectedFolder === 'uncategorized' ? 'active' : ''}`}
                onClick={() => setSelectedFolder('uncategorized')}
              >
                {t('uncategorized')}
              </button>
            )}
          </div>
        </div>
      )}



      {/* Entries List */}
      <div
        className="entries-container"
        ref={containerRef}
        onKeyDown={handleKeyDown}
      >
        {sortedEntries.length === 0 && !entries?.length ? (
          <div className="no-entry">
            <div className="no-entry-icon">
              <KeyIcon />
            </div>
            <p className="no-entry-text">{t('no_accounts_yet')}</p>
            <p className="no-entry-hint">{t('tap_to_add')}</p>
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="no-entry">
            <div className="no-entry-icon">
              <SearchIcon />
            </div>
            <p className="no-entry-text">{t('no_matching_accounts')}</p>
            <p className="no-entry-hint">{t('try_different_search')}</p>
          </div>
        ) : (
          sortedEntries.map((entry: OTPEntryInterface) => (
            <EntryComponent
              key={entry.hash}
              entry={entry}
              filtered={false}
              notSearched={searchText !== '' &&
                !entry.issuer.toLowerCase().includes(searchText.toLowerCase()) &&
                (!entry.account || !entry.account.toLowerCase().includes(searchText.toLowerCase()))
              }
              tabindex={getTabindex(entry)}
              onEdit={handleEditEntry}
              draggable={style.isEditing}
              onDragStart={(e: React.DragEvent) => handleDragStart(e, entry.hash)}
              onDragEnd={handleDragEnd}
              onDragOver={(e: React.DragEvent) => handleDragOver(e, entry.hash)}
              onDragLeave={handleDragLeave}
              onDrop={(e: React.DragEvent) => handleDrop(e, entry.hash)}
              isDragOver={dragOverEntryHash === entry.hash}
            />
          ))
        )}
      </div>

      {/* Add Account FAB */}
      {!style.isEditing && (
        <button
          className="add-account-fab"
          onClick={() => setShowMethodSelector(true)}
          title={t('add_account')}
          aria-label={t('add_account')}
        >
          <PlusIcon />
        </button>
      )}

      {/* Add Method Selector Modal */}
      {showMethodSelector && (
        <div className="modal-overlay" onClick={() => setShowMethodSelector(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <AddMethodSelector
              onClose={() => setShowMethodSelector(false)}
              onSuccess={handleAddAccountSuccess}
              onManualEntry={() => {
                setShowMethodSelector(false);
                setShowAddForm(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Add Account Form Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <AddAccountForm
              onClose={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}



      {/* Edit Account Modal */}
      {showEditModal && editingEntry && (
        <div className="modal-overlay" onClick={handleEditClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <EditAccountModal
              entry={editingEntry}
              onClose={handleEditClose}
              onSave={handleEditSave}
            />
          </div>
        </div>
      )}

    </>
  );
}
