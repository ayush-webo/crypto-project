let currentPage = 1;
const rowsPerPage = 20;
let allCryptos = [];
const previousPrices = {};

document.addEventListener("DOMContentLoaded", function () {
    // Add a loading indicator to the table
    const tableBody = document.querySelector("#cryptoTable tbody");
    tableBody.innerHTML = "<tr><td colspan='11'>Loading cryptocurrency data...</td></tr>";
    
    // Initialize both data sources
    fetchCryptoData();
    fetchCryptos();
    
    // Set up auto-refresh
    setInterval(fetchCryptoData, 15000);
});

async function fetchCryptoData() {
    try {
        const tableBody = document.querySelector("#cryptoTable tbody");
        
        let response = await fetch("http://localhost:9090/api/v1/query?query=coin_market_price_usd{}");
        let data = await response.json();
        
        if (!data.data || !data.data.result) {
            throw new Error("Invalid data format received");
        }
        
        allCryptos = data.data.result;
        displayPage(currentPage);
    } catch (error) {
        console.error("Error fetching data:", error);
        const tableBody = document.querySelector("#cryptoTable tbody");
        tableBody.innerHTML = "<tr><td colspan='11'>Error loading cryptocurrency data. Please try again later.</td></tr>";
    }
}

async function displayPage(page) {
    const tableBody = document.querySelector("#cryptoTable tbody");
    
    // Show loading state
    tableBody.innerHTML = "<tr><td colspan='11'>Loading cryptocurrency data...</td></tr>";
    
    try {
        let start = (page - 1) * rowsPerPage;
        let end = start + rowsPerPage;
        let cryptosToDisplay = allCryptos.slice(start, end);
        
        // Create a batch of promises for all metrics
        const rowPromises = cryptosToDisplay.map(async (crypto) => {
            let name = crypto.metric.name || "N/A";
            let symbol = crypto.metric.symbol || "N/A";
            let price = parseFloat(crypto.value[1]).toFixed(2);
            
            // Fetch all metrics in parallel
            const [marketCap, volume, circulatingSupply, cmcRank, totalSupply, 
                   percentChange1h, percentChange24h, percentChange7d] = await Promise.all([
                fetchMetric("coin_market_market_cap_usd", name),
                fetchMetric("coin_market_volume_24h_usd", name),
                fetchMetric("coin_market_circulating_supply", name),
                fetchMetric("coin_market_cmc_rank", name),
                fetchMetric("coin_market_total_supply", name),
                fetchMetric("coin_market_percent_change_1h_usd", name),
                fetchMetric("coin_market_percent_change_24h_usd", name),
                fetchMetric("coin_market_percent_change_7d_usd", name)
            ]);
            
            // Format row with price change highlighting
            const priceChangeClass = getPercentChangeClass(percentChange24h);
            
            return `
                <tr>
                    <td>${name}</td>
                    <td>${symbol}</td>
                    <td>$${price}</td>
                    <td>$${marketCap}</td>
                    <td>$${volume}</td>
                    <td>${circulatingSupply}</td>
                    <td>${cmcRank}</td>
                    <td>${totalSupply}</td>
                    <td class="${getPercentChangeClass(percentChange1h)}">${percentChange1h}%</td>
                    <td class="${getPercentChangeClass(percentChange24h)}">${percentChange24h}%</td>
                    <td class="${getPercentChangeClass(percentChange7d)}">${percentChange7d}%</td>
                </tr>
            `;
        });
        
        // Wait for all rows to be ready
        const rows = await Promise.all(rowPromises);
        tableBody.innerHTML = rows.join('');
        
        updatePaginationControls();
    } catch (error) {
        console.error("Error displaying data:", error);
        tableBody.innerHTML = "<tr><td colspan='11'>Error displaying cryptocurrency data. Please try again later.</td></tr>";
    }
}

// Helper function for styling percentage changes
function getPercentChangeClass(percentChange) {
    if (percentChange === "N/A") return "";
    const value = parseFloat(percentChange);
    if (value > 0) return "positive-change";
    if (value < 0) return "negative-change";
    return "";
}

async function fetchMetric(metric, name) {
    try {
        let response = await fetch(`http://localhost:9090/api/v1/query?query=${metric}{name="${name}"}`);
        let data = await response.json();
        return data.data.result[0] ? parseFloat(data.data.result[0].value[1]).toFixed(2) : "N/A";
    } catch (error) {
        console.error(`Error fetching ${metric} for ${name}:`, error);
        return "N/A";
    }
}

function updatePaginationControls() {
    let pagination = document.getElementById("pagination");
    pagination.innerHTML = "";
    let totalPages = Math.ceil(allCryptos.length / rowsPerPage);
    let maxVisible = 5; // Show only 5 pages at a time

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    // Add Previous button
    if (currentPage > 1) {
        let prevButton = document.createElement("button");
        prevButton.innerText = "«";
        prevButton.onclick = () => { currentPage--; displayPage(currentPage); };
        pagination.appendChild(prevButton);
    }

    // First Page
    if (startPage > 1) {
        let firstButton = createPaginationButton(1);
        pagination.appendChild(firstButton);
        if (startPage > 2) {
            pagination.appendChild(createEllipsis());
        }
    }

    // Visible Page Numbers
    for (let i = startPage; i <= endPage; i++) {
        let button = createPaginationButton(i);
        pagination.appendChild(button);
    }

    // Last Page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pagination.appendChild(createEllipsis());
        }
        let lastButton = createPaginationButton(totalPages);
        pagination.appendChild(lastButton);
    }

    // Add Next button
    if (currentPage < totalPages) {
        let nextButton = document.createElement("button");
        nextButton.innerText = "»";
        nextButton.onclick = () => { currentPage++; displayPage(currentPage); };
        pagination.appendChild(nextButton);
    }
}

// Helper: Create Pagination Button
function createPaginationButton(page) {
    let button = document.createElement("button");
    button.innerText = page;
    button.className = page === currentPage ? "active" : "";
    button.onclick = () => { currentPage = page; displayPage(page); };
    return button;
}

// Helper: Create Ellipsis (...)
function createEllipsis() {
    let span = document.createElement("span");
    span.innerText = "...";
    span.style.margin = "0 5px";
    return span;
}

// Search functionality
const baseGrafanaUrl = "http://localhost:3000/d-solo/aeh7b09m5xtdsf/coinmarketcap-single?orgId=1&from=1743351590602&to=1743437990602&timezone=browser&refresh=15m";
const panelIds = [8, 12, 13];
let allCryptos1 = [];

async function fetchCryptos() {
    try {
        const suggestionsDiv = document.getElementById("suggestions");
        
        const response = await fetch("http://localhost:9090/api/v1/label/name/values");
        const data = await response.json();
        
        if (!data.data) {
            throw new Error("Invalid data format for cryptocurrency names");
        }
        
        allCryptos1 = data.data || [];
        
        // Enable search once data is loaded
        document.getElementById("search").disabled = false;
        document.getElementById("search").placeholder = "Search cryptocurrency...";
    } catch (error) {
        console.error("Error fetching cryptocurrencies from Prometheus:", error);
        document.getElementById("search").placeholder = "Search unavailable";
    }
}

function showSuggestions() {
    const input = document.getElementById("search").value.toLowerCase();
    const suggestionsDiv = document.getElementById("suggestions");
    suggestionsDiv.innerHTML = "";
    
    if (!input) return;
    
    const filtered = allCryptos1.filter(crypto => 
        crypto.toLowerCase().includes(input)
    ).slice(0, 10);
    
    if (filtered.length === 0) {
        const noResults = document.createElement("div");
        noResults.innerText = "No cryptocurrencies found";
        noResults.className = "no-results";
        suggestionsDiv.appendChild(noResults);
        return;
    }
    
    filtered.forEach(crypto => {
        const suggestion = document.createElement("div");
        suggestion.innerText = crypto;
        suggestion.onclick = () => selectCrypto(crypto);
        suggestionsDiv.appendChild(suggestion);
    });
}

function selectCrypto(crypto) {
    document.getElementById("search").value = crypto;
    document.getElementById("suggestions").innerHTML = "";
    
    // Show loading state in iframes
    panelIds.forEach((id, index) => {
        const iframe = document.getElementById(`panel${index + 1}`);
        iframe.src = "about:blank";
        iframe.onload = () => {
            if (iframe.contentDocument) {
                iframe.contentDocument.body.innerHTML = "Loading chart...";
            }
        };
    });
    
    // Load charts with slight delay between each to reduce server load
    panelIds.forEach((id, index) => {
        setTimeout(() => {
            document.getElementById(`panel${index + 1}`).src = 
                `${baseGrafanaUrl}&var-name=${encodeURIComponent(crypto)}&panelId=${id}`;
        }, index * 300);
    });
}

// Close suggestions when clicking outside
document.addEventListener('click', function(event) {
    const suggestionsDiv = document.getElementById("suggestions");
    const searchContainer = document.getElementById("search-container");
    
    if (!searchContainer.contains(event.target)) {
        suggestionsDiv.innerHTML = "";
    }
});