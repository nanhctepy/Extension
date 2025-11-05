const $ = id => document.getElementById(id);

const msg = async (action, data) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { action, ...data });
};

const cap = txt => txt.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

const status = (txt, color = '#94a3b8', type = '') => {
  const s = $('status');
  const span = s.querySelector('span');
  if (span) {
    span.textContent = cap(txt);
  } else {
    s.textContent = cap(txt);
  }
  

  s.classList.remove('active', 'processing', 'error');
  

  if (type === 'success' || color === '#10b981' || color === '#059669') {
    s.classList.add('active');
  } else if (type === 'processing' || color === '#3b82f6' || color === '#2563eb') {
    s.classList.add('processing');
  } else if (type === 'error' || color === '#ef4444' || color === '#dc2626') {
    s.classList.add('error');
  } else {
    s.style.color = color;
  }
};

status('Ready', '#10b981', 'success');

let currentEmail = null;
let displayName = '';
let regPassword = '';

const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (err) {
    console.error('Lỗi khi copy:', err);
    return false;
  }
};

const loadCurrentEmail = async () => {
  try {
    const stored = await chrome.storage.local.get(['currentEmail', 'displayName', 'regPassword']);
    if (stored.currentEmail) {
      currentEmail = stored.currentEmail;
      if ($('emailInput')) $('emailInput').value = stored.currentEmail;
    }
    displayName = stored.displayName || '';
    regPassword = stored.regPassword || '';
    if ($('displayNameInput')) $('displayNameInput').value = displayName || '';
    if ($('passwordInput')) $('passwordInput').value = regPassword || '';
  } catch (err) {
    console.error('Lỗi khi load email:', err);
  }
};

loadCurrentEmail();

const createTempEmail = async () => {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'createTempEmail' });
    if (result && result.success) {
      currentEmail = result.email;
      return result.email;
    } else {
      throw new Error(result?.error || 'Không thể tạo email');
    }
  } catch (err) {
    status('Error creating email: ' + err.message, '#ef4444', 'error');
    return null;
  }
};

$('openReg').onclick = () => {
  chrome.tabs.create({ url: 'https://discord.com/register' });
};

$('regAcc').onclick = async () => {
  status('Creating email...', '#3b82f6', 'processing');
  const email = await createTempEmail();
  if (!email) {
    return;
  }
  
  status('Email created: ' + email.substring(0, 20) + '...', '#10b981', 'success');
  
  const copied = await copyToClipboard(email);
  if (!copied) {
    console.warn('Không thể copy email vào clipboard');
  }
  
  setTimeout(() => {
    msg('startReg', { email });
    status('Registering account...', '#3b82f6', 'processing');
  }, 500);
};

const saveSettings = async () => {
  try {
    displayName = ($('displayNameInput')?.value || '').trim();
    regPassword = ($('passwordInput')?.value || '').trim();
    await chrome.storage.local.set({ displayName, regPassword });
    status('Settings saved', '#10b981', 'success');
  } catch (e) {
    console.error('Lỗi khi lưu cài đặt:', e);
    status('Failed to save settings', '#ef4444', 'error');
  }
};



if ($('saveSettings')) {
  $('saveSettings').onclick = async () => {
    await saveSettings();
  };
}



$('verifyBtn').onclick = () => {
  const group = $('verifyGroup');
  group.classList.toggle('show');
};

$('verifySubmit').onclick = async () => {
  let email = $('emailInput').value.trim();
  if (!email) {
    const stored = await chrome.storage.local.get(['currentEmail']);
    if (stored.currentEmail) {
      email = stored.currentEmail;
      $('emailInput').value = email;
    } else {
      status('Please enter email!', '#ef4444', 'error');
      return;
    }
  }
  
  status('Checking mail...', '#3b82f6', 'processing');
  
  try {
    const messagesResult = await chrome.runtime.sendMessage({ action: 'getMessages' });
    
    if (!messagesResult || !messagesResult.success) {
      throw new Error(messagesResult?.error || 'Không thể lấy messages');
    }
    
    const data = messagesResult.data;
    
    const messages = data.data || [];
    const mailbox = data.mailbox || '';
    
    if (messages && messages.length > 0) {
      const discordMail = messages.find(m => 
        (m.from?.includes('discord.com')) && 
        (m.subject?.includes('Verify') || m.subject?.includes('Xác') || m.subject?.includes('verification'))
      );
      
      if (discordMail) {
        const uid = discordMail.uid;
        const contentResult = await chrome.runtime.sendMessage({ 
          action: 'getMessageContent', 
          uid: uid 
        });
        
        if (contentResult && contentResult.success) {
          const fullData = contentResult.data;

          const html = fullData.bodyHtml || '';
          const text = html.replace(/<[^>]*>/g, ' '); 

          const allLinks = [];

          const hrefMatches = html.match(/href="([^"]+)"/g) || [];
          hrefMatches.forEach(m => {
            const url = m.match(/href="([^"]+)"/)[1];
            if (url.includes('discord.com') || url.includes('click.discord.com')) {
              allLinks.push(url.replace(/&amp;/g, '&'));
            }
          });

          const urlMatches = html.match(/https?:\/\/[^\s<>"']+/g) || [];
          urlMatches.forEach(url => {
            if (url.includes('discord.com') || url.includes('click.discord.com')) {
              const cleanUrl = url.replace(/&amp;/g, '&').replace(/[<>"']/g, '');
              if (!allLinks.includes(cleanUrl)) {
                allLinks.push(cleanUrl);
              }
            }
          });
          
          const textUrlMatches = text.match(/https?:\/\/[^\s]+/g) || [];
          textUrlMatches.forEach(url => {
            if (url.includes('discord.com') || url.includes('click.discord.com')) {
              const cleanUrl = url.trim();
              if (!allLinks.includes(cleanUrl)) {
                allLinks.push(cleanUrl);
              }
            }
          });

          console.log('=== DEBUG: TẤT CẢ LINKS TÌM ĐƯỢC ===');
          allLinks.forEach((link, idx) => {
            console.log(`${idx + 1}. ${link}`);
          });
          console.log('=====================================');

          if (allLinks.length > 0) {
            displayLinks(allLinks);
            status(`Found ${allLinks.length} link(s). Please select a link!`, '#10b981', 'success');
          } else {
            status('No links found!', '#ef4444', 'error');
          }
        } else {

          const preview = discordMail.bodyPreview || '';
          const previewMatches = preview.match(/https?:\/\/[^\s]+/g) || [];
          
          console.log('=== DEBUG: LINKS TRONG PREVIEW ===');
          previewMatches.forEach((link, idx) => {
            console.log(`${idx + 1}. ${link}`);
          });
          
       
          if (previewMatches.length > 0) {
            displayLinks(previewMatches);
            status(`Found ${previewMatches.length} link(s) from preview. Please select a link!`, '#10b981', 'success');
          } else {
            console.log('❌ KHÔNG TÌM THẤY LINK TRONG PREVIEW');
            status('No verify link found!', '#ef4444', 'error');
          }
        }
      } else {
        status('No mail from Discord yet!', '#f59e0b');
      }
    } else {
      status('No emails found!', '#f59e0b');
    }
  } catch (err) {
    status('Error checking mail: ' + err.message, '#ef4444', 'error');
  }
};

const displayLinks = (links) => {
  const container = $('linksContainer');
  const list = $('linksList');
  

  list.innerHTML = '';
  

  links.forEach((link, idx) => {
    const item = document.createElement('div');
    item.className = 'link-item';
    
    let linkType = 'Link Discord';
    if (link.includes('click.discord.com')) {
      linkType = '🔗 Link Verify (click.discord.com)';
    } else if (link.includes('discord.com') && (link.includes('verify') || link.includes('verification'))) {
      linkType = '✅ Link Verify (discord.com)';
    }
    
    item.innerHTML = `
      <div class="link-item-title">
        <span>${idx + 1}.</span>
        <span>${linkType}</span>
      </div>
      <div class="link-item-url">${link}</div>
    `;
    
    item.onclick = () => {
      console.log('Opening link:', link);
      status('Opening link...', '#3b82f6', 'processing');
      chrome.tabs.create({ url: link });
      container.classList.remove('show');
    };
    
    list.appendChild(item);
  });

  container.classList.add('show');

  if (links.length >= 2) {
    const secondLink = links[1];
    console.log('Auto opening link #2:', secondLink);
    status('Auto opening link #2...', '#3b82f6', 'processing');
    setTimeout(() => {
      chrome.tabs.create({ url: secondLink });
    }, 500);
  }
};

$('getToken').onclick = async () => {
  status('Getting token...', '#3b82f6', 'processing');
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    status('No active tab found!', '#ef4444', 'error');
    return;
  }

  if (!tab.url?.includes('discord.com')) {
    status('Please open Discord.com first!', '#ef4444', 'error');
    return;
  }
  
  try {
    chrome.tabs.sendMessage(tab.id, { action: 'getToken' }, (response) => {
      if (chrome.runtime.lastError) {
        status('Error: ' + chrome.runtime.lastError.message, '#ef4444', 'error');
        return;
      }
    });
  } catch (err) {
    status('Error getting token: ' + err.message, '#ef4444', 'error');
  }
};

$('copyToken').onclick = async () => {
  const tokenInput = $('tokenInput');
  const token = tokenInput.value;
  
  if (!token) {
    status('No token to copy!', '#ef4444', 'error');
    return;
  }
  
  const copied = await copyToClipboard(token);
  if (copied) {
    status('Token copied to clipboard!', '#10b981', 'success');

    const copyBtn = $('copyToken');
    const originalIcon = copyBtn.innerHTML;
    copyBtn.innerHTML = '<span class="btn-icon">✓</span>';
    copyBtn.style.color = '#10b981';
    
    setTimeout(() => {
      copyBtn.innerHTML = originalIcon;
      copyBtn.style.color = '';
    }, 2000);
  } else {
    status('Failed to copy token!', '#ef4444', 'error');
  }
};

$('clearData').onclick = () => {
  msg('clearData');
  status('Clearing data...', '#ef4444', 'processing');
};

chrome.runtime.onMessage.addListener(async (req) => {
  if (req.action === 'emailCreated' && req.email) {
    const copied = await copyToClipboard(req.email);
    if (copied) {
      status('Email copied: ' + req.email.substring(0, 20) + '...', '#10b981', 'success');
    } else {
      status('Email created: ' + req.email.substring(0, 20) + '...', '#10b981', 'success');
    }
    if ($('emailInput')) {
      $('emailInput').value = req.email;
      currentEmail = req.email;
    }
  }
  
  if (req.action === 'tokenReceived' && req.token) {
    const tokenContainer = $('tokenContainer');
    const tokenInput = $('tokenInput');
    
    tokenInput.value = req.token;
    tokenContainer.style.display = 'block';
    status('Token retrieved successfully!', '#10b981', 'success');
    
    const copied = await copyToClipboard(req.token);
    if (copied) {
      status('Token copied to clipboard!', '#10b981', 'success');
    }
  }
  
  if (req.action === 'tokenError') {
    status('Token not found. Make sure you are logged in!', '#ef4444', 'error');
    const tokenContainer = $('tokenContainer');
    tokenContainer.style.display = 'none';
  }
});