// Nombre del archivo CSV
const CSV_FILE = '02_modern-renewable-energy-consumption.csv';
let globalData = [];
let tableData = [];
let chartInstances = {}; // Para almacenar instancias de Chart.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar y parsear el CSV
    fetch(CSV_FILE)
        .then(response => response.text())
        .then(data => {
            const parsedData = parseCSV(data);
            
            // Filtrar datos para la entidad 'World' (Global)
            globalData = parsedData.filter(d => d.Entity === 'World');
            
            // Usar todos los datos para la tabla, pero limpiar los campos vacíos
            tableData = parsedData.map(d => {
                const cleanD = {};
                for (const key in d) {
                    // Reemplazar valores vacíos/nulos con 'N/A' o 0
                    cleanD[key] = (d[key] === null || d[key] === undefined || d[key] === '') ? 'N/A' : d[key];
                    // Convertir números relevantes
                    if (!isNaN(parseFloat(d[key])) && key !== 'Entity' && key !== 'Code' && key !== 'Year') {
                        cleanD[key] = parseFloat(d[key]);
                    }
                }
                return cleanD;
            });
            
            // Inicializar componentes
            initializeTable();
            if (globalData.length > 0) {
                initializeDashboard(globalData);
                initializeCalculadora(globalData);
            }
        })
        .catch(error => {
            console.error('Error al cargar o parsear el CSV:', error);
            alert('Error al cargar los datos históricos. Revisa la consola para más detalles.');
        });
});

// Función para parsear CSV (simple, asume separador de comas)
function parseCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => {
            // Limpieza básica de comillas y espacios
            const value = values[index] ? values[index].trim().replace(/"/g, '') : '';
            row[header.trim().replace(/"/g, '')] = value;
        });
        data.push(row);
    }
    return data;
}

// =======================================================
// 2. Dashboard y Gráficos (Chart.js)
// =======================================================

function initializeDashboard(data) {
    // Usamos el dato más reciente para gráficos de barra y torta (2022)
    const latestData = data[data.length - 1]; 
    if (!latestData) return;

    // Campos del CSV
    const fields = {
        'biomasa': 'Geo Biomass Other - TWh',
        'solar': 'Solar Generation - TWh',
        'eolica': 'Wind Generation - TWh',
        'hidro': 'Hydro Generation - TWh'
    };

    // Gráfico de Barras: Producción de Energía Renovable por Fuente (Usando TWh)
    const produccionLabels = ['Biomasa y Otras', 'Solar', 'Eólica', 'Hidro'];
    const produccionData = [
        latestData[fields.biomasa] || 0,
        latestData[fields.solar] || 0,
        latestData[fields.eolica] || 0,
        latestData[fields.hidro] || 0
    ].map(Number);
    
    // Gráfico de Torta: Participación de Energías Renovables (Usando shares, estos campos no están en tu CSV actual, se simulan con TWh)
    const totalRenovable = produccionData.reduce((sum, val) => sum + val, 0);
    const participacionData = produccionData.map(twh => (twh / totalRenovable) * 100);

    // Gráfico de Líneas: Tendencia en la Capacidad Instalada (Usamos los TWh de generación como proxy)
    const lineasLabels = data.map(d => d.Year);
    const lineasDataSets = [
        { label: 'Hidro Generación (TWh)', data: data.map(d => Number(d[fields.hidro]) || 0), borderColor: '#007bff', fill: false },
        { label: 'Eólica Generación (TWh)', data: data.map(d => Number(d[fields.eolica]) || 0), borderColor: '#28a745', fill: false },
        { label: 'Solar Generación (TWh)', data: data.map(d => Number(d[fields.solar]) || 0), borderColor: '#ffc107', fill: false }
    ];
    
    // Gráfico de Área: Comparación entre Consumo de Energía Renovable y Convencional (Simulado, ya que no hay datos de Convencional)
    const areaLabels = data.map(d => d.Year);
    const areaRenovableData = data.map(d => Number(d['modern-renewable-energy-consumption'] || 0)); // Usamos el campo general

    // Simulamos Consumo Convencional (Ej: Total Energía - Renovable, si no tenemos el total, usamos un proxy)
    const areaConvencionalData = areaRenovableData.map(r => r * 4); // Proxy: Asumimos que lo convencional es 4 veces lo renovable

    // Creación de gráficos
    createChart('chart-barras', 'bar', produccionLabels, produccionData, 'Producción (TWh)', ['#1e7e34', '#ffc107', '#007bff', '#20c997']);
    createChart('chart-torta', 'doughnut', produccionLabels, participacionData, 'Participación (%)', ['#1e7e34', '#ffc107', '#007bff', '#20c997']);
    createChart('chart-lineas', 'line', lineasLabels, lineasDataSets, 'Generación (TWh)');
    createChart('chart-area', 'line', areaLabels, 
        [
            { label: 'Consumo Renovable (TWh)', data: areaRenovableData, backgroundColor: 'rgba(40, 167, 69, 0.4)', borderColor: '#28a745', fill: true },
            { label: 'Consumo Convencional (Estimado TWh)', data: areaConvencionalData, backgroundColor: 'rgba(220, 53, 69, 0.4)', borderColor: '#dc3545', fill: true }
        ], 
        'Consumo (TWh)');
}

function createChart(canvasId, type, labels, datasetsOrData, yAxisLabel, colors = []) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Destruir instancia anterior si existe
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }
    
    let config = { type, data: {}, options: { responsive: true, maintainAspectRatio: false } };

    if (type === 'bar' || type === 'doughnut') {
        config.data = {
            labels: labels,
            datasets: [{
                label: yAxisLabel,
                data: datasetsOrData,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.6', '1')), // Bordes más fuertes
                borderWidth: 1
            }]
        };
        if (type === 'bar') {
            config.options.scales = { y: { title: { display: true, text: yAxisLabel }, beginAtZero: true } };
        }
        if (type === 'doughnut') {
            config.options.plugins = { tooltip: { callbacks: { label: (context) => `${context.label}: ${context.raw.toFixed(2)}%` } } };
        }
    } else { // line and area
        config.data = { labels: labels, datasets: datasetsOrData };
        config.options.scales = { y: { title: { display: true, text: yAxisLabel }, beginAtZero: true } };
    }

    chartInstances[canvasId] = new Chart(ctx, config);
}


// =======================================================
// 3. Tabla de Datos Históricos
// =======================================================

function initializeTable() {
    // Cargar la tabla completa al inicio
    cargarTablaCompleta();
    
    // Asignar el evento al input de filtrado para buscar al presionar Enter
    document.getElementById('filtro-year').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            filtrarTabla();
        }
    });
}

function cargarTabla(data) {
    const tableHead = document.querySelector('#datos-historicos-tabla thead');
    const tableBody = document.querySelector('#datos-historicos-tabla tbody');
    
    // Limpiar tabla
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="100%">No hay datos disponibles para el filtro seleccionado.</td></tr>';
        return;
    }

    // Cabeceras (usar las cabeceras del primer objeto de datos)
    const headers = Object.keys(data[0]);
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Filas
    data.forEach(rowData => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            // Formatear números
            const value = rowData[header];
            if (typeof value === 'number') {
                td.textContent = value.toLocaleString('es-ES', { maximumFractionDigits: 2 });
            } else {
                td.textContent = value;
            }
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

function cargarTablaCompleta() {
    cargarTabla(tableData);
}

function filtrarTabla() {
    const year = document.getElementById('filtro-year').value;
    let filteredData = tableData;

    if (year && !isNaN(parseInt(year))) {
        const yearInt = parseInt(year);
        // Filtrar por el año exacto
        filteredData = tableData.filter(d => Number(d.Year) === yearInt);
    }
    
    cargarTabla(filteredData);
}

// =======================================================
// 4. Calculadora de Consumo
// =======================================================

function initializeCalculadora(data) {
    const calculadoraForm = document.getElementById('calculadora-form');
    const capacidadTotalInput = document.getElementById('capacidad-total');
    const resultadoDiv = document.getElementById('resultado-calculadora');
    
    // Usamos la generación total del último año como proxy de Capacidad Instalada (en TWh)
    const latestData = data[data.length - 1];
    
    // Suma de la capacidad de generación TWh del último año
    const totalRenovableTWh = [
        latestData['Geo Biomass Other - TWh'],
        latestData['Solar Generation - TWh'],
        latestData['Wind Generation - TWh'],
        latestData['Hydro Generation - TWh']
    ].map(Number).reduce((sum, val) => sum + val, 0);

    // Mostrar el valor global calculado
    capacidadTotalInput.value = totalRenovableTWh.toLocaleString('es-ES', { maximumFractionDigits: 2 });

    calculadoraForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const consumoUsuario = Number(document.getElementById('consumo-total').value);
        
        // --- Paso 1: Obtener la Producción Total Renovable Global (TWh) ---
        const totalRenovableProduccion = totalRenovableTWh; // Ya calculado arriba

        // --- Paso 2: Obtener la Producción Eléctrica Global (Proxy) ---
        // Dado que no tenemos un campo "Total Electricidad" directamente, la estimamos:
        // (Suma de las 4 renovables * 5, asumiendo que lo convencional es 4 veces lo renovable)
        const totalProduccionGlobal = totalRenovableProduccion * 5; 
        
        // --- Paso 3: Calcular la Proporción Renovable Global (%) ---
        const proporcionRenovableGlobal = (totalRenovableProduccion / totalProduccionGlobal) * 100;
        
        // --- Paso 4: Calcular el Porcentaje en el Consumo del Usuario (kWh) ---
        // Asumimos que la electricidad que consume el usuario tiene la misma proporción renovable que la red global
        const consumoRenovableUsuario = consumoUsuario * (proporcionRenovableGlobal / 100);
        
        // --- Paso 5: Calcular el Porcentaje de Energía Renovable en el Consumo del Usuario (%) ---
        // ¡Es el mismo porcentaje global!
        const porcentajeConsumoRenovable = proporcionRenovableGlobal;
        
        // Mostrar resultados
        resultadoDiv.innerHTML = `
            <p><strong>Proporción Global de Energía Renovable en la Red:</strong> ${proporcionRenovableGlobal.toFixed(2)}%</p>
            <p>De tu consumo total de ${consumoUsuario.toLocaleString('es-ES')} kWh/año, se estima que:</p>
            <p class="final-result"><strong>${consumoRenovableUsuario.toLocaleString('es-ES', { maximumFractionDigits: 2 })} kWh</strong> (${porcentajeConsumoRenovable.toFixed(2)}%) provienen de fuentes renovables.</p>
        `;
    });
}