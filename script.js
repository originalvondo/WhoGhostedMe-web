// DOM Elements
const usernameInput = document.getElementById('usernameInput');
const searchBtn = document.getElementById('searchBtn');
const status = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const followersProgress = document.getElementById('followersProgress');
const followingsProgress = document.getElementById('followingsProgress');
const followersProgressText = document.getElementById('followersProgressText');
const followingsProgressText = document.getElementById('followingsProgressText');
const resultsSection = document.getElementById('resultsSection');
const resultsTitle = document.getElementById('resultsTitle');
const resultsStats = document.getElementById('resultsStats');
const results = document.getElementById('results');
const copyBtn = document.getElementById('copyBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const resetBtn = document.getElementById('resetBtn');
const emptyState = document.getElementById('emptyState');
const checkAnotherBtn = document.getElementById('checkAnotherBtn');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');

let ghostedUsers = [];
let currentUsername = '';

// Initialize
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch();
});

searchBtn.addEventListener('click', handleSearch);
resetBtn.addEventListener('click', reset);
checkAnotherBtn.addEventListener('click', reset);
retryBtn.addEventListener('click', reset);

copyBtn.addEventListener('click', copyToClipboard);
exportCsvBtn.addEventListener('click', exportCsv);

function showStatus(text, isLoading = true) {
  status.innerHTML = isLoading
    ? `${text}<span class="spinner"></span>`
    : text;
}

function hideAllSections() {
  progressContainer.style.display = 'none';
  resultsSection.style.display = 'none';
  emptyState.style.display = 'none';
  errorSection.style.display = 'none';
  status.textContent = '';
}

function handleSearch() {
  const username = usernameInput.value.trim();
  if (!username) {
    showStatus('Please enter a username', false);
    return;
  }

  hideAllSections();
  currentUsername = username;
  searchBtn.disabled = true;
  usernameInput.disabled = true;

  showStatus('Fetching data...');
  progressContainer.style.display = 'block';

  fetchGhostedUsers(username);
}

async function fetchGhostedUsers(username) {
  try {
    // Fetch user ID
    let userId = null;

    try {
      const userQueryRes = await fetch(
        `https://www.instagram.com/web/search/topsearch/?query=${username}`
      );
      const userQueryJson = await userQueryRes.json();
      const user = userQueryJson.users.find(u => u.user.username === username);
      userId = user?.user?.pk || null;
    } catch (e) {
      console.warn("Topsearch failed:", e);
    }

    if (!userId) {
      throw new Error('User not found. Make sure the username is correct and the profile is public.');
    }

    // Fetch followers and followings in parallel
    const [followers, followings] = await Promise.all([
      fetchFollowers(userId),
      fetchFollowings(userId)
    ]);

    // Compare to find ghosted users
    const followerUsernames = new Set(followers.map(f => f.username));
    const ghosted = followings.filter(f => !followerUsernames.has(f.username));

    ghostedUsers = ghosted;
    displayResults(username, followers.length, followings.length, ghosted);
  } catch (error) {
    showError(error.message);
  } finally {
    searchBtn.disabled = false;
    usernameInput.disabled = false;
  }
}

async function fetchFollowers(userId) {
  let followers = [];
  let after = null;
  let hasNext = true;
  let totalFetched = 0;
  let totalCount = 0;

  while (hasNext) {
    try {
      const res = await fetch(
        `https://www.instagram.com/graphql/query/?query_hash=c76146de99bb02f6415203be841dd25a&variables=` +
        encodeURIComponent(
          JSON.stringify({
            id: userId,
            first: 100,
            after: after,
          })
        )
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (!data.data?.user?.edge_followed_by) {
        throw new Error('Unable to fetch followers. The profile might be private.');
      }

      hasNext = data.data.user.edge_followed_by.page_info.has_next_page;
      after = data.data.user.edge_followed_by.page_info.end_cursor;

      if (totalCount === 0) {
        totalCount = data.data.user.edge_followed_by.count;
      }

      const newFollowers = data.data.user.edge_followed_by.edges.map(({ node }) => ({
        username: node.username,
        full_name: node.full_name,
        profile_pic_url: node.profile_pic_url,
        profile_pic_url_hd: node.profile_pic_url_hd,
      }));

      followers = followers.concat(newFollowers);
      totalFetched += newFollowers.length;

      // Update progress
      const percentage = Math.min((totalFetched / totalCount) * 100, 100);
      followersProgress.style.width = `${percentage}%`;
      followersProgressText.textContent = `${totalFetched} / ${totalCount} loaded`;
    } catch (error) {
      console.error('Error fetching followers:', error);
      if (totalFetched === 0) {
        throw new Error('Failed to fetch followers. Please try again.');
      }
      break;
    }
  }

  return followers;
}

async function fetchFollowings(userId) {
  let followings = [];
  let after = null;
  let hasNext = true;
  let totalFetched = 0;
  let totalCount = 0;

  while (hasNext) {
    try {
      const res = await fetch(
        `https://www.instagram.com/graphql/query/?query_hash=d04b0a864b4b54837c0d870b0e77e076&variables=` +
        encodeURIComponent(
          JSON.stringify({
            id: userId,
            first: 100,
            after: after,
          })
        )
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (!data.data?.user?.edge_follow) {
        throw new Error('Unable to fetch following. The profile might be private.');
      }

      hasNext = data.data.user.edge_follow.page_info.has_next_page;
      after = data.data.user.edge_follow.page_info.end_cursor;

      if (totalCount === 0) {
        totalCount = data.data.user.edge_follow.count;
      }

      const newFollowings = data.data.user.edge_follow.edges.map(({ node }) => ({
        username: node.username,
        full_name: node.full_name,
        profile_pic_url: node.profile_pic_url,
        profile_pic_url_hd: node.profile_pic_url_hd,
      }));

      followings = followings.concat(newFollowings);
      totalFetched += newFollowings.length;

      // Update progress
      const percentage = Math.min((totalFetched / totalCount) * 100, 100);
      followingsProgress.style.width = `${percentage}%`;
      followingsProgressText.textContent = `${totalFetched} / ${totalCount} loaded`;
    } catch (error) {
      console.error('Error fetching followings:', error);
      if (totalFetched === 0) {
        throw new Error('Failed to fetch following. Please try again.');
      }
      break;
    }
  }

  return followings;
}

function displayResults(username, followersCount, followingsCount, ghostedUsers) {
  hideAllSections();

  if (ghostedUsers.length === 0) {
    emptyState.style.display = 'block';
    status.textContent = '';
  } else {
    resultsSection.style.display = 'block';
    resultsTitle.textContent = `@${username} - ${ghostedUsers.length} ghost${ghostedUsers.length !== 1 ? 's' : ''}`;

    resultsStats.innerHTML = `
      <div class="stat">
        <div class="stat-number">${followersCount}</div>
        <div class="stat-label">Followers</div>
      </div>
      <div class="stat">
        <div class="stat-number">${followingsCount}</div>
        <div class="stat-label">Following</div>
      </div>
      <div class="stat">
        <div class="stat-number">${ghostedUsers.length}</div>
        <div class="stat-label">Not Following Back</div>
      </div>
    `;

    renderGhostedUsers(ghostedUsers);
  }

  status.textContent = '';
}

function renderGhostedUsers(users) {
  results.innerHTML = '';

  users.forEach(user => {
    const li = document.createElement('div');
    li.className = 'user-card';

    const profilePic = user.profile_pic_url_hd || user.profile_pic_url || '';
    const fullName = user.full_name || '';
    const username = user.username || '';

    li.innerHTML = `
      <a href="https://instagram.com/${username}" target="_blank" class="user-link">
        <img src="${profilePic}" alt="${username}" class="profile-pic" data-fallback="true" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjUiIGN5PSIyNSIgcj0iMjUiIGZpbGw9IiNlMGUwZTAiLz4KPHBhdGggZD0iTTI1IDE1QzE5LjQ3NzEgMTUgMTUgMTkuNDc3MSAxNSAyNUMxNSAzMC41MjI5IDE5LjQ3NzEgMzUgMjUgMzVDMzAuNTIyOSAzNSAzNSAzMC41MjI5IDM1IDI1QzM1IDE5LjQ3NzEgMzAuNTIyOSAxNSAyNSAxNVoiIGZpbGw9IiM5OTkiLz4KPHBhdGggZD0iTTI1IDM3QzI5LjQxODMgMzcgMzMgMzMuNDE4MyAzMyAyOUMzMyAyMy41ODE3IDI5LjQxODMgMjAgMjUgMjBDMjAuNTgxNyAyMCAxNyAyMy41ODE3IDE3IDI5QzE3IDMzLjQxODMgMjAuNTgxNyAzNyAyNSAzN1oiIGZpbGw9IiM5OTkiLz4KPC9zdmc+'">
        <div class="user-info">
          <span class="username">@${username}</span>
          ${fullName ? `<span class="full-name">${fullName}</span>` : ''}
        </div>
      </a>
    `;

    results.appendChild(li);
  });
}

function copyToClipboard() {
  const text = ghostedUsers
    .map(u => `@${u.username}${u.full_name ? ` (${u.full_name})` : ''}`)
    .join('\n');

  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = 'Copy to Clipboard';
      copyBtn.classList.remove('copied');
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
}

function exportCsv() {
  if (!ghostedUsers.length) return;

  const headers = 'Full Name,Username,Profile URL\n';
  const rows = ghostedUsers
    .map(u => `"${u.full_name || ''}","${u.username}","https://instagram.com/${u.username}"`)
    .join('\n');
  const content = headers + rows;

  downloadFile(`ghosted_${currentUsername}_${new Date().toISOString().split('T')[0]}.csv`, content, 'text/csv');
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function showError(message) {
  hideAllSections();
  errorSection.style.display = 'block';
  errorMessage.textContent = `Error: ${message}`;
  status.textContent = '';
}

function reset() {
  hideAllSections();
  usernameInput.value = '';
  usernameInput.focus();
  searchBtn.disabled = false;
  usernameInput.disabled = false;
  ghostedUsers = [];
  currentUsername = '';
  status.textContent = '';
  followersProgress.style.width = '0%';
  followingsProgress.style.width = '0%';
  followersProgressText.textContent = '0 loaded';
  followingsProgressText.textContent = '0 loaded';
}

// Focus input on load
usernameInput.focus();
