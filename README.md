## Organización de ramas

El proyecto utiliza una estructura de ramas basada en funcionalidades:

main            # Rama principal (versión estable)
staging         # Rama para integración, pruebas y verificaciones antes de llevar los cambios a main
feature/*       # Ramas de desarrollo por módulo
docs            # Documentos entregables del proyecto

Cada rama feature/* representa un módulo específico del sistema.

La rama main se mantiene limpia y estable, mientras que el desarrollo se realiza en ramas feature/*. 

La rama docs se utiliza exclusivamente para almacenar los documentos entregables del proyecto en formato PDF.
