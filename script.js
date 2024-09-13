let isbnSet = new Set();
let camera_active = false;
const toggleButton = document.getElementById('toggle-camera');
const scanResult = document.getElementById('scan-result');
const bookTable = document.getElementById('book-table').getElementsByTagName('tbody')[0];
const loadingIndicator = document.querySelector('.loading');

toggleButton.addEventListener('click', toggleCamera);

function toggleCamera() {
    if (camera_active) {
        Quagga.stop();
        camera_active = false;
        toggleButton.textContent = 'Actívame';
    } else {
        startCamera();
        camera_active = true;
        toggleButton.textContent = 'Desactivar Cámara';
    }
}

function startCamera() {
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#scanner-container'),
            constraints: {
                width: 480,
                height: 480,
                facingMode: "environment"
            },
        },
        decoder: {
            readers: ["ean_reader"]
        }
    }, function(err) {
        if (err) {
            console.error(err);
            scanResult.textContent = 'Error al iniciar la cámara: ' + err;
            return;
        }
        Quagga.start();
    });

    Quagga.onDetected(handleScan);
}

const fetchAveragePrice = require('./scraper'); // Asegúrate de que la ruta sea correcta

async function handleScan(result) {
    const isbn = result.codeResult.code; // Obtiene el ISBN del resultado
    console.log('ISBN escaneado:', isbn); // Muestra el ISBN en la consola

    // Actualiza el campo de entrada con el ISBN escaneado
    document.getElementById('scanned-isbn').value = isbn;

    // Si el ISBN ya ha sido escaneado, solo actualiza el campo y no detiene la búsqueda
    if (isbnSet.has(isbn)) {
        scanResult.textContent = 'Este libro ya ha sido escaneado.';
    } else {
        isbnSet.add(isbn); // Agrega el ISBN al conjunto
    }

    Quagga.stop(); // Detiene el escaneo
    camera_active = false;
    toggleButton.textContent = 'Actívame Nuevamente';

    loadingIndicator.style.display = 'block'; // Muestra el indicador de carga
    scanResult.textContent = ''; // Limpia el resultado anterior

    try {
        console.log('Buscando datos para ISBN:', isbn);
        const bookData = await fetchBookData(isbn); // Llama a la función para obtener datos del libro
        console.log('Datos del libro:', bookData);
        const priceData = await fetchPriceData(isbn); // Llama a la función para obtener datos de precios
        console.log('Datos de precios:', priceData);
        addBookToTable(bookData, priceData); // Agrega el libro a la tabla
        scanResult.textContent = 'Libro escaneado con éxito: ' + bookData.title; // Muestra el resultado
    } catch (error) {
        scanResult.textContent = 'Error al obtener datos del libro: ' + error.message; // Manejo de errores
        console.error(error); // Muestra el error en la consola
    } finally {
        loadingIndicator.style.display = 'none'; // Oculta el indicador de carga
    }
}

async function fetchBookData(isbn) {
    const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
    const response = await fetch(googleBooksUrl);
    
    if (!response.ok) {
        throw new Error('Error en la solicitud de datos del libro.');
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
        const bookInfo = data.items[0].volumeInfo;
        return {
            title: bookInfo.title,
            isbn: isbn.replace(/(\d{3})(\d{1})(\d{3})(\d{5})(\d{1})/, "$1-$2-$3-$4-$5"),
            publisher: bookInfo.publisher || 'N/A',
            year: bookInfo.publishedDate ? bookInfo.publishedDate.substring(0, 4) : 'N/A',
            cover: bookInfo.imageLinks ? bookInfo.imageLinks.thumbnail : 'https://via.placeholder.com/60x90.png?text=No+Cover'
        };
    } else {
        throw new Error('No se encontró información para este ISBN.');
    }
}

async function fetchPriceData(isbn) {
    const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
    const response = await fetch(googleBooksUrl);
    
    if (!response.ok) {
        throw new Error('Error en la solicitud de datos de precios.');
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
        const bookId = data.items[0].id;
        const googleBooksLink = `https://books.google.cl/books?id=${bookId}&sitesec=buy&hl=es&source=gbs_atb`;

        // Simulación de obtención de precios con retraso aleatorio
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
        const newPrice = Math.floor(Math.random() * 20000) + 10000;
        const usedPrice = Math.floor(Math.random() * 15000) + 5000;
        const trendNew = Math.random() > 0.5 ? 'up' : 'down';
        const trendUsed = Math.random() > 0.5 ? 'up' : 'down';

        return {
            new: newPrice,
            used: usedPrice,
            trendNew: trendNew,
            trendUsed: trendUsed,
            newPriceUrl: googleBooksLink,
            usedPriceUrl: `https://www.buscalibre.cl/libros/search/?q=${isbn}`
        };
    } else {
        throw new Error('No se encontró información para este ISBN.');
    }
}

function addBookToTable(book, prices) {
    const row = bookTable.insertRow(0);
    
    row.innerHTML = `
        <td><img src="${book.cover}" alt="${book.title}" class="book-cover"></td>
        <td>${book.title}</td>
        <td>${book.isbn}</td>
        <td>${book.publisher}</td>
        <td>${book.year}</td>
        <td><a href="${prices.newPriceUrl}" target="_blank">Ver precios</a></td>
        <td><a href="${prices.usedPriceUrl}" target="_blank">Ver precios</a></td>
    `;
}

document.getElementById('export-excel').addEventListener('click', exportToExcel);
document.getElementById('export-pdf').addEventListener('click', exportToPDF);

function exportToExcel() {
    const wb = XLSX.utils.table_to_book(document.getElementById('book-table'), {sheet: "Libros Escaneados"});
    XLSX.writeFile(wb, 'libros_escaneados.xlsx');
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html: '#book-table' });
    doc.save('libros_escaneados.pdf');
}
