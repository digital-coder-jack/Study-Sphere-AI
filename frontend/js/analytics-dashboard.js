/* =====================================================================
   Study Sphere AI  -  analytics-dashboard.js
   Admin Analytics Dashboard Logic
   ===================================================================== */

(function() {
  let weeklyGrowthChart = null;
  let monthlyGrowthChart = null;

  async function loadDashboardStats() {
    try {
      const response = await fetch('/api/analytics/dashboard-stats');
      
      if (!response.ok) {
        if (response.status === 403) {
          showError('You do not have permission to view this dashboard.');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const stats = await response.json();
      updateDashboard(stats);
    } catch (error) {
      console.error('Failed to load analytics stats:', error);
      showError('Failed to load analytics data. Please try again later.');
    }
  }

  function updateDashboard(stats) {
    // Update key metrics
    document.getElementById('totalVisitors').textContent = stats.total_visitors || 0;
    document.getElementById('activeVisitorsToday').textContent = stats.active_visitors_today || 0;
    document.getElementById('newVisitorsToday').textContent = stats.new_visitors_today || 0;
    document.getElementById('returningVisitors').textContent = stats.returning_visitors || 0;
    document.getElementById('avgSessionDuration').textContent = (stats.average_session_duration || 0).toFixed(0);

    // Update feature usage
    document.getElementById('totalAIChats').textContent = stats.total_ai_chats || 0;
    document.getElementById('totalQuizAttempts').textContent = stats.total_quiz_attempts || 0;
    document.getElementById('totalNotesGenerated').textContent = stats.total_notes_generated || 0;

    // Update most visited pages table
    updateMostVisitedPages(stats.most_visited_pages || []);

    // Update charts
    updateWeeklyGrowthChart(stats.weekly_growth || []);
    updateMonthlyGrowthChart(stats.monthly_growth || []);
  }

  function updateMostVisitedPages(pages) {
    const tbody = document.getElementById('mostVisitedPagesTable');
    tbody.innerHTML = '';

    if (pages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--text-dim);">No data available</td></tr>';
      return;
    }

    pages.forEach(page => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${page._id || 'Unknown'}</td>
        <td><b>${page.count || 0}</b></td>
      `;
      tbody.appendChild(row);
    });
  }

  function updateWeeklyGrowthChart(weeklyData) {
    const ctx = document.getElementById('weeklyGrowthChart');
    if (!ctx) return;

    const labels = weeklyData.map(d => d.date || '');
    const data = weeklyData.map(d => d.new_users || 0);

    if (weeklyGrowthChart) {
      weeklyGrowthChart.data.labels = labels;
      weeklyGrowthChart.data.datasets[0].data = data;
      weeklyGrowthChart.update();
    } else {
      weeklyGrowthChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'New Users',
            data: data,
            borderColor: '#6d7bff',
            backgroundColor: 'rgba(109, 123, 255, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#6d7bff',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              labels: {
                color: 'var(--text)',
                font: { size: 12, weight: '600' }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: 'var(--text-dim)' },
              grid: { color: 'var(--border)' }
            },
            x: {
              ticks: { color: 'var(--text-dim)' },
              grid: { color: 'var(--border)' }
            }
          }
        }
      });
    }
  }

  function updateMonthlyGrowthChart(monthlyData) {
    const ctx = document.getElementById('monthlyGrowthChart');
    if (!ctx) return;

    const labels = monthlyData.map(d => d.week || '');
    const data = monthlyData.map(d => d.new_users || 0);

    if (monthlyGrowthChart) {
      monthlyGrowthChart.data.labels = labels;
      monthlyGrowthChart.data.datasets[0].data = data;
      monthlyGrowthChart.update();
    } else {
      monthlyGrowthChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'New Users',
            data: data,
            backgroundColor: 'rgba(168, 85, 247, 0.6)',
            borderColor: '#a855f7',
            borderWidth: 1,
            borderRadius: 8,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              labels: {
                color: 'var(--text)',
                font: { size: 12, weight: '600' }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: 'var(--text-dim)' },
              grid: { color: 'var(--border)' }
            },
            x: {
              ticks: { color: 'var(--text-dim)' },
              grid: { color: 'var(--border)' }
            }
          }
        }
      });
    }
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    const content = document.querySelector('.content');
    if (content) {
      content.insertBefore(errorDiv, content.firstChild);
    }
  }

  // Load dashboard stats on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDashboardStats);
  } else {
    loadDashboardStats();
  }

  // Refresh stats every 30 seconds
  setInterval(loadDashboardStats, 30000);
})();
