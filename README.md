# Luxor-Project

##  Descripción
Luxor-Project es un sistema desarrollado con una arquitectura modular, enfocado en la gestión de diferentes funcionalidades como usuarios, productos, inventario, ventas y más.  
El objetivo principal es organizar el desarrollo del proyecto de forma clara, utilizando buenas prácticas como el uso de ramas en Git para separar cada módulo.

---

## Organización de ramas

El proyecto utiliza una estructura de ramas basada en funcionalidades:

main        # Rama principal (versión estable)  
staging     # Rama para integración, pruebas y verificaciones antes de llevar los cambios a main  
feature/*   # Ramas de desarrollo por módulo  
docs        # Documentos entregables del proyecto  

Cada rama feature/* representa un módulo específico del sistema.

La rama main se mantiene limpia y estable, mientras que el desarrollo se realiza en ramas feature/*.

La rama staging se utiliza como punto intermedio para pruebas antes de pasar a producción.

La rama docs se utiliza exclusivamente para almacenar los documentos entregables del proyecto en formato PDF.

---

##  Módulos del sistema

El proyecto está dividido en los siguientes módulos:

- Autenticación
- Usuarios
- Productos
- Inventario
- Pedidos
- Pagos
- Ventas
- Proveedores
- IA

Cada uno de estos módulos se desarrolla en su propia rama `feature/*`.

---

##  Flujo de trabajo

El flujo de trabajo del proyecto sigue estos pasos:

1. Se crea una rama `feature/*` para desarrollar una funcionalidad específica.
2. Una vez terminada, se integran los cambios en la rama `staging`.
3. En `staging` se realizan pruebas y validaciones.
4. Si todo está correcto, los cambios se pasan a la rama `main`.

Este flujo permite mantener estabilidad y control en el desarrollo.

---

##  Estructura del proyecto (general)

docs/        # Archivos del frontend o entregables  
data/        # Datos como productos en JSON (simulación de base de datos)  
assets/      # Imágenes, PDFs u otros recursos  
js/          # Lógica del sistema  
css/         # Estilos  

---

## Manejo de datos (productos)

Los productos del sistema se almacenan en archivos tipo JSON, los cuales funcionan como una base de datos simple para el frontend.

La información de los productos puede provenir de documentos PDF, los cuales son procesados manualmente para extraer datos como:

- Nombre
- Precio
- Descripción
- Imagen

Estos datos se estructuran en archivos como:

data/productos.json

---

##  Tecnologías utilizadas

- Git y GitHub
- HTML, CSS y JavaScript
- JSON para manejo de datos

---

## Equipo de trabajo

- Dally Ramirez - 241035
- Denis Roberto Rodríguez Jiménez - 21151
- Diego Sandoval - 231977
- Javier Chávez - 23132
- Adrián López - 231361


---

## 📄 Documentación

La documentación del proyecto se encuentra en la rama `docs`, donde se almacenan los entregables en formato PDF requeridos para el curso.

---
