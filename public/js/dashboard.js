/* global Chart */
// Admin dashboard charts. Data is rendered into the page by the server.
(function () {
  const dataElement = document.getElementById("dashboard-data");
  if (!dataElement || !window.Chart) return;

  const data = JSON.parse(dataElement.textContent);
  const charts = [];

  // One series per chart, so one colour each; checked for contrast on both surfaces
  function theme() {
    const dark = document.documentElement.classList.contains("dark");
    return {
      series: dark ? "#3b82f6" : "#2563eb",
      fill: dark ? "rgba(59, 130, 246, 0.15)" : "rgba(37, 99, 235, 0.1)",
      ink: dark ? "#9ca3af" : "#6b7280",
      grid: dark ? "rgba(255, 255, 255, 0.08)" : "rgba(17, 24, 39, 0.06)",
    };
  }

  const money = (value) =>
    value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const shortDate = (iso) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  function baseOptions(colors) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.ink },
          border: { color: colors.grid },
        },
        y: {
          grid: { color: colors.grid },
          ticks: { color: colors.ink },
          border: { display: false },
        },
      },
    };
  }

  function horizontalBars(id, labels, values, unit) {
    const colors = theme();
    const options = baseOptions(colors);
    options.indexAxis = "y";
    options.scales = {
      x: {
        grid: { color: colors.grid },
        ticks: { color: colors.ink, precision: 0 },
        border: { display: false },
      },
      y: { grid: { display: false }, ticks: { color: colors.ink }, border: { color: colors.grid } },
    };
    options.plugins.tooltip = { callbacks: { label: (ctx) => ` ${ctx.parsed.x} ${unit}` } };

    return new Chart(document.getElementById(id), {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors.series,
            borderRadius: 4,
            borderSkipped: "start",
            maxBarThickness: 18,
          },
        ],
      },
      options,
    });
  }

  function revenueChart() {
    const colors = theme();
    const options = baseOptions(colors);
    options.interaction = { mode: "index", intersect: false };
    options.scales.x.ticks.maxTicksLimit = 6;
    options.scales.y.ticks.callback = (value) => money(value);
    options.plugins.tooltip = { callbacks: { label: (ctx) => ` ${money(ctx.parsed.y)}` } };

    return new Chart(document.getElementById("revenue-chart"), {
      type: "line",
      data: {
        labels: data.revenue.map((row) => shortDate(row.day)),
        datasets: [
          {
            data: data.revenue.map((row) => row.amount),
            borderColor: colors.series,
            backgroundColor: colors.fill,
            borderWidth: 2,
            fill: "origin",
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
        ],
      },
      options,
    });
  }

  function render() {
    charts.splice(0).forEach((chart) => chart.destroy());
    charts.push(
      revenueChart(),
      horizontalBars(
        "products-chart",
        data.topProducts.map((row) => row.name),
        data.topProducts.map((row) => row.units),
        "units",
      ),
      horizontalBars(
        "status-chart",
        data.statuses.map((row) => row.status[0].toUpperCase() + row.status.slice(1)),
        data.statuses.map((row) => row.count),
        "orders",
      ),
    );
  }

  render();

  // Charts are drawn, so the loading placeholders can go
  document.querySelectorAll("[data-chart-frame]").forEach((frame) => {
    frame.classList.remove("animate-pulse", "bg-gray-100", "dark:bg-gray-800");
  });

  // Redraw with the right colours when the theme changes
  document.addEventListener("themechange", render);
})();
