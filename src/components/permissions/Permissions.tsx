import React, { useState, useEffect } from 'react';
import { usePermissions } from '../../store';
import ButtonInput from '../common/ButtonInput';

// Use Permission interface from global declarations
declare global {
  interface Permission {
    id: string;
    description: string;
    revocable: boolean;
    validation?: (() => Promise<{ valid: boolean; message?: string }>)[];
  }
}

export default function Permissions() {
  const { permissions, dispatch } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Load permissions on component mount
    const loadPermissions = async () => {
      try {
        setLoading(true);
        const perms = await chrome.permissions.getAll();
        const permissionList: Permission[] = [];
        
        // Add permissions
        if (perms.permissions) {
          for (const perm of perms.permissions) {
            permissionList.push({
              id: perm,
              description: chrome.i18n.getMessage(`permission_${perm}`) || perm,
              revocable: false, // Core permissions are not revocable
            });
          }
        }
        
        // Add origins
        if (perms.origins) {
          for (const origin of perms.origins) {
            let revocable = true;
            let description = chrome.i18n.getMessage(`permission_${origin}`) || origin;
            
            // Special handling for certain permissions
            if (origin === 'https://www.google.com/*') {
              description = chrome.i18n.getMessage('permission_sync_clock') || origin;
            } else if (origin.includes('dropboxapi.com')) {
              description = chrome.i18n.getMessage('permission_dropbox') || origin;
              // Check if Dropbox token exists
              // This would need to be checked against storage
            } else if (origin.includes('googleapis.com') || origin.includes('accounts.google.com')) {
              description = chrome.i18n.getMessage('permission_drive') || origin;
              // Check if Drive token exists
              // This would need to be checked against storage
            } else if (origin.includes('microsoft.com')) {
              description = chrome.i18n.getMessage('permission_onedrive') || origin;
              // Check if OneDrive token exists
              // This would need to be checked against storage
            }
            
            permissionList.push({
              id: origin,
              description,
              revocable,
            });
          }
        }
        
        // Sort permissions: non-revocable first
        permissionList.sort((a, b) => {
          if (a.revocable !== b.revocable) {
            return a.revocable ? 1 : -1;
          }
          return 0;
        });
        
        dispatch({ type: 'setPermissions', payload: permissionList });
      } catch (error) {
        console.error('Failed to load permissions:', error);
        setMessage('加载权限失败');
      } finally {
        setLoading(false);
      }
    };
    
    loadPermissions();
  }, [dispatch]);

  const handleRevokePermission = async (permissionId: string) => {
    try {
      setLoading(true);
      setMessage('');
      
      // Find the permission
      const permission = permissions.find(p => p.id === permissionId);
      if (!permission) return;
      
      // Run validation functions if they exist
      if (permission.validation) {
        const validationResults = await Promise.all(
          permission.validation.map(async (validator) => await validator())
        );
        
        const invalidResults = validationResults.filter(result => !result.valid);
        if (invalidResults.length > 0) {
          const messages = await Promise.all(
            invalidResults.map(async (result) => result.message || '验证失败')
          );
          setMessage(messages.join('\n'));
          setLoading(false);
          return;
        }
      }
      
      // Revoke the permission
      if (permissionId.startsWith('https://')) {
        // It's an origin permission
        await chrome.permissions.remove({
          origins: [permissionId]
        });
      } else {
        // It's a regular permission
        await chrome.permissions.remove({
          permissions: [permissionId]
        });
      }
      
      // Reload permissions
      const loadPermissions = async () => {
        try {
          setLoading(true);
          const perms = await chrome.permissions.getAll();
          const permissionList: Permission[] = [];
          
          // Add permissions
          if (perms.permissions) {
            for (const perm of perms.permissions) {
              permissionList.push({
                id: perm,
                description: chrome.i18n.getMessage(`permission_${perm}`) || perm,
                revocable: false, // Core permissions are not revocable
              });
            }
          }
          
          // Add origins
          if (perms.origins) {
            for (const origin of perms.origins) {
              let revocable = true;
              let description = chrome.i18n.getMessage(`permission_${origin}`) || origin;
              
              // Special handling for certain permissions
              if (origin === 'https://www.google.com/*') {
                description = chrome.i18n.getMessage('permission_sync_clock') || origin;
              } else if (origin.includes('dropboxapi.com')) {
                description = chrome.i18n.getMessage('permission_dropbox') || origin;
              } else if (origin.includes('googleapis.com') || origin.includes('accounts.google.com')) {
                description = chrome.i18n.getMessage('permission_drive') || origin;
              } else if (origin.includes('microsoft.com')) {
                description = chrome.i18n.getMessage('permission_onedrive') || origin;
              }
              
              permissionList.push({
                id: origin,
                description,
                revocable,
              });
            }
          }
          
          // Sort Permissions: non-revocable first
          permissionList.sort((a, b) => {
            if (a.revocable !== b.revocable) {
              return a.revocable ? 1 : -1;
            }
            return 0;
          });
          
          dispatch({ type: 'setPermissions', payload: permissionList });
        } catch (error) {
          console.error('Failed to load permissions:', error);
          setMessage('加载权限失败');
        } finally {
          setLoading(false);
        }
      };
      
      await loadPermissions();
      setMessage('权限已撤销');
    } catch (error) {
      console.error('Failed to revoke permission:', error);
      setMessage('撤销权限失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>权限管理</h1>
      
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>加载中...</p>
        </div>
      )}
      
      {message && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '20px' 
        }}>
          <p>{message}</p>
          <ButtonInput
            onClick={() => setMessage('')}
            className="close-button"
          >
            关闭
          </ButtonInput>
        </div>
      )}
      
      {!loading && !message && (
        <div>
          <h2>当前权限</h2>
          {permissions.length === 0 ? (
            <p>没有权限</p>
          ) : (
            <div>
              {permissions.map((permission) => (
                <div
                  key={permission.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>{permission.description}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {permission.revocable ? '可撤销' : '必需'}
                    </div>
                  </div>
                  {permission.revocable && (
                    <ButtonInput
                      onClick={() => handleRevokePermission(permission.id)}
                      className="revoke-button"
                    >
                      撤销
                    </ButtonInput>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}