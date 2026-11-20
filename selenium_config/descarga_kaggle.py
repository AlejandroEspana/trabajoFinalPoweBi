import sqlite3
import time
import zipfile
from datetime import datetime
from pathlib import Path

import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# Ruta donde se descargará el archivo
download_directory = Path.home() / "Downloads"
download_directory.mkdir(parents=True, exist_ok=True)
database_path = Path(__file__).with_name("descargas.db")

# Perfil propio de Chrome para Selenium: guarda la sesión de Kaggle.
# Selenium NO usa tu Chrome normal, abre uno limpio; por eso la primera vez
# hay que iniciar sesión en la ventana que se abre (queda guardada después).
profile_directory = Path(__file__).with_name("chrome_profile")
primera_vez = not profile_directory.exists()

url = "https://www.kaggle.com/datasets/aljarah/xAPI-Edu-Data"


def create_downloads_table():
    """Crea la tabla de archivos descargados"""
    with sqlite3.connect(database_path) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS archivos_descargados (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre_archivo TEXT NOT NULL,
                ruta_archivo TEXT NOT NULL,
                url TEXT NOT NULL,
                fecha_descarga TEXT NOT NULL,
                tamano_bytes INTEGER NOT NULL
            )
        """)


def save_download(file_path, url):
    """Guarda los datos de un archivo descargado usando pandas y SQL."""
    download_data = pd.DataFrame([{
        "nombre_archivo": file_path.name,
        "ruta_archivo": str(file_path),
        "url": url,
        "fecha_descarga": datetime.now().isoformat(timespec="seconds"),
        "tamano_bytes": file_path.stat().st_size,
    }])

    with sqlite3.connect(database_path) as connection:
        download_data.to_sql(
            "archivos_descargados",
            connection,
            if_exists="append",
            index=False,
        )


def wait_for_download(files_before, extension=".zip", timeout=120):
    """Espera hasta que Chrome termine de escribir un archivo nuevo."""
    end_time = time.time() + timeout

    while time.time() < end_time:
        new_files = [
            file_path for file_path in download_directory.iterdir()
            if file_path.is_file()
            and file_path.name not in files_before
            and file_path.suffix.lower() == extension
        ]
        temporary_files = list(download_directory.glob("*.crdownload"))
        if new_files and not temporary_files:
            return max(new_files, key=lambda path: path.stat().st_mtime)
        time.sleep(1)

    raise TimeoutError(f"La descarga no terminó en {timeout} segundos")


create_downloads_table()

# Configurar Chrome para descargar archivos automáticamente
chrome_options = Options()
chrome_options.add_argument(f"--user-data-dir={profile_directory}")
chrome_options.add_experimental_option("prefs", {
    "download.default_directory": str(download_directory),
    "download.prompt_for_download": False,
    "download.directory_upgrade": True,
    "safebrowsing.enabled": True
})

driver = webdriver.Chrome(options=chrome_options)
wait = WebDriverWait(driver, 30)

try:
    # 1. Abrir la página del dataset
    driver.get(url)

    if primera_vez:
        input("Inicia sesión en Kaggle en la ventana de Chrome y presiona Enter...")
        driver.get(url)

    # 2. Kaggle carga con JavaScript: esperar a que aparezca el botón Download
    download_button = wait.until(EC.element_to_be_clickable((
        By.XPATH,
        "//button[contains(normalize-space(.), 'Download') or contains(normalize-space(.), 'Descargar')]"
    )))

    files_before = {file_path.name for file_path in download_directory.iterdir()}
    download_button.click()
    print("Botón Download presionado")

    # 3. En el menú que se abre, elegir la descarga como zip
    zip_option = wait.until(EC.element_to_be_clickable((
        By.XPATH,
        "//*[contains(text(), 'Download dataset as zip') or contains(text(), 'Descargar')]"
    )))
    zip_option.click()
    print("Descarga del zip iniciada")

    # 4. Esperar a que termine y registrar el zip en SQLite
    zip_file = wait_for_download(files_before, ".zip")
    save_download(zip_file, url)
    print(f"Registrado en SQLite: {zip_file.name}")

    # 5. Extraer el CSV del zip y registrarlo
    files_before = {file_path.name for file_path in download_directory.iterdir()}
    with zipfile.ZipFile(zip_file) as zf:
        zf.extractall(download_directory)

    csv_files = [
        file_path for file_path in download_directory.iterdir()
        if file_path.name not in files_before and file_path.suffix.lower() == ".csv"
    ]
    for csv_file in csv_files:
        save_download(csv_file, url)
        print(f"CSV extraído y registrado: {csv_file.name}")

finally:
    # Cerrar el navegador
    driver.quit()
