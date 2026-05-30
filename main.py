# =========================================
# main.py — Interfaz de Usuario (Flet)
# =========================================

import flet as ft
import os
import base64
import threading

from config import BASE_PATH, ASSETS_PATH
import database
import auth
import ai_engine
import pdf_manager
import vector_store


# =========================================
# IMAGENES BASE64
# =========================================

def obtener_64(nombre):
    """Busca una imagen en BASE_PATH o ASSETS_PATH y la retorna en base64."""

    def buscar_archivo(nombre_buscar):
        target_base = os.path.splitext(nombre_buscar)[0]
        for base in [BASE_PATH, ASSETS_PATH]:
            ruta = os.path.join(base, nombre_buscar)
            if os.path.exists(ruta):
                return ruta
            if os.path.isdir(base):
                for nombre_archivo in os.listdir(base):
                    archivo_base, archivo_ext = os.path.splitext(nombre_archivo)
                    if archivo_base == target_base:
                        return os.path.join(base, nombre_archivo)
                    if archivo_base.startswith(target_base) and archivo_ext.lower() in [".jpeg", ".jpg", ".png"]:
                        return os.path.join(base, nombre_archivo)
        return None

    try:
        ruta = buscar_archivo(nombre)
        if ruta and os.path.exists(ruta):
            ext = os.path.splitext(ruta)[1].lower()
            mime = "image/png" if ext == ".png" else "image/jpeg"
            with open(ruta, "rb") as f:
                contenido = base64.b64encode(f.read()).decode("utf-8")
            return f"data:{mime};base64,{contenido}"
    except Exception as e:
        print("ERROR IMAGEN:", e)
    return None


# =========================================
# APP PRINCIPAL
# =========================================

def main(page: ft.Page):

    page.title = "LUXO"
    page.bgcolor = "#111111"
    page.theme_mode = "dark"
    page.window_width = 1100
    page.window_height = 850

    user_info = {"id": None, "nombre": "", "rol": ""}

    def mostrar_snack(mensaje, color="#7CFC00"):
        page.snack_bar = ft.SnackBar(
            ft.Text(mensaje, color=color, size=16, weight="bold"),
            bgcolor="#111111",
            duration=5000,
            show_close_icon=True,
            action="Cerrar",
        )
        page.snack_bar.open = True
        page.update()

    # =====================================
    # IMAGENES
    # =====================================

    img_avatar = obtener_64("avatar_luxo.png")
    img_fondo = obtener_64("istockphoto-468228782-612x612.jpg")

    # =====================================
    # CERRAR SESION
    # =====================================

    def cerrar_sesion():
        user_info["id"] = None
        user_info["nombre"] = ""
        user_info["rol"] = ""
        page.clean()
        page.add(login_ui)
        page.update()

    # =====================================
    # FILE PICKERS
    # =====================================

    def on_pick_cargar(e):
        if e.files:
            ruta = e.files[0].path
            exito, mensaje = pdf_manager.cargar_pdf(ruta)
            color = "#7CFC00" if exito else "#FF4500"
            mostrar_snack(mensaje, color=color)

    def on_pick_actualizar(e):
        if e.files:
            ruta = e.files[0].path
            exito, mensaje = pdf_manager.actualizar_pdf(ruta)
            color = "#7CFC00" if exito else "#FF4500"
            mostrar_snack(mensaje, color=color)

    picker_cargar = ft.FilePicker(on_result=on_pick_cargar)
    picker_actualizar = ft.FilePicker(on_result=on_pick_actualizar)
    page.overlay.extend([picker_cargar, picker_actualizar])

    # =====================================
    # BORRAR MANUAL (ADMIN)
    # =====================================

    def borrar_manual_admin():
        manuales = database.obtener_manuales_listado()
        if not manuales:
            mostrar_snack("No hay manuales para borrar.")
            return

        def confirmar_borrado(id_manual, nombre):
            def _borrar(e):
                exito, mensaje = pdf_manager.borrar_manual(id_manual, nombre)
                page.dialog.open = False
                page.update()
                color = "#7CFC00" if exito else "#FF4500"
                mostrar_snack(mensaje, color=color)
            return _borrar

        def cerrar_dialog(e):
            page.dialog.open = False
            page.update()

        items = []
        for m in manuales:
            nombre = m.get("Nombre_Archivo") or ""
            version = m.get("Version") or ""
            items.append(
                ft.Row([
                    ft.Text(nombre, expand=3, selectable=True, color="white"),
                    ft.Text(f"v{version}", width=60, color="#D8B4FE"),
                    ft.ElevatedButton(
                        "BORRAR",
                        on_click=confirmar_borrado(m["ID_Manual"], nombre),
                        bgcolor="#FF4500",
                        color="white",
                    ),
                ], alignment="spaceBetween")
            )

        dialog = ft.AlertDialog(
            title=ft.Text("Borrar Manual — selecciona el que deseas eliminar", color="white"),
            content=ft.Container(
                ft.Column(items, spacing=10, scroll=ft.ScrollMode.AUTO),
                width=650, height=350, bgcolor="#1A1A1A",
            ),
            bgcolor="#1A1A1A",
            actions=[ft.TextButton("Cancelar", on_click=cerrar_dialog)],
            actions_alignment="end",
        )
        page.dialog = dialog
        page.dialog.open = True
        page.update()

    # =====================================
    # CHAT
    # =====================================

    def cargar_chat():

        page.clean()

        # Re-registrar pickers en overlay
        if picker_cargar not in page.overlay:
            page.overlay.extend([picker_cargar, picker_actualizar])
        page.update()

        chat_display = ft.ListView(expand=True, spacing=10, padding=20)

        # =================================
        # ENVIAR MENSAJE
        # =================================

        def enviar_mensaje(e):
            if not input_msg.value:
                return

            user_text = input_msg.value

            # Mostrar mensaje del usuario
            chat_display.controls.append(
                ft.Container(
                    content=ft.Text(
                        f"{user_info['nombre']}: {user_text}",
                        color="white", weight="bold",
                    ),
                    bgcolor="#222222",
                    padding=10,
                    border_radius=10,
                )
            )
            input_msg.value = ""

            # Indicador de carga
            loading = ft.Container(
                content=ft.Row([
                    ft.ProgressRing(width=20, height=20, color="#D8B4FE"),
                    ft.Text("LUXO está pensando...", color="#D8B4FE", italic=True),
                ], spacing=10),
                padding=10,
            )
            chat_display.controls.append(loading)
            page.update()

            # Procesar en hilo para no bloquear UI
            def _procesar():
                try:
                    resultado = ai_engine.generar_respuesta(user_text, user_info["id"])

                    # Remover indicador de carga
                    if loading in chat_display.controls:
                        chat_display.controls.remove(loading)

                    # Mostrar respuesta
                    respuesta_row = ft.Column(spacing=5)

                    respuesta_row.controls.append(
                        ft.Container(
                            content=ft.Text(
                                f"LUXO: {resultado['respuesta']}",
                                color="white", weight="bold", selectable=True,
                            ),
                            bgcolor="#111111",
                            padding=10,
                            border_radius=10,
                        )
                    )

                    # Botón de descarga si aplica
                    if resultado["intencion"] == "descargar" and resultado["id_manual"]:
                        respuesta_row.controls.append(
                            ft.ElevatedButton(
                                f"📥 DESCARGAR PDF: {resultado['nombre_pdf']}",
                                on_click=lambda ev, idm=resultado["id_manual"]: pdf_manager.descargar_pdf(idm),
                                bgcolor="#444444",
                                color="white",
                            )
                        )

                    # Botones de feedback 👍/👎
                    if resultado["id_conversacion"]:
                        id_conv = resultado["id_conversacion"]

                        def on_feedback_positivo(ev, idc=id_conv):
                            database.guardar_feedback(idc, True)
                            mostrar_snack("👍 ¡Gracias por tu feedback!", color="#7CFC00")

                        def on_feedback_negativo(ev, idc=id_conv):
                            database.guardar_feedback(idc, False)
                            mostrar_snack("👎 Feedback registrado. Mejoraremos.", color="#FFA500")

                        respuesta_row.controls.append(
                            ft.Row([
                                ft.IconButton(
                                    ft.Icons.THUMB_UP_ALT_OUTLINED,
                                    icon_color="#7CFC00",
                                    tooltip="Respuesta útil",
                                    on_click=on_feedback_positivo,
                                    icon_size=18,
                                ),
                                ft.IconButton(
                                    ft.Icons.THUMB_DOWN_ALT_OUTLINED,
                                    icon_color="#FF4500",
                                    tooltip="Respuesta no útil",
                                    on_click=on_feedback_negativo,
                                    icon_size=18,
                                ),
                            ], spacing=0)
                        )

                    chat_display.controls.append(respuesta_row)

                except Exception as ex:
                    if loading in chat_display.controls:
                        chat_display.controls.remove(loading)
                    chat_display.controls.append(
                        ft.Text(f"ERROR: {ex}", color="red")
                    )

                page.update()

            threading.Thread(target=_procesar, daemon=True).start()

        # =================================
        # INPUT
        # =================================

        input_msg = ft.TextField(
            hint_text="Escribe tu consulta...",
            expand=True,
            on_submit=enviar_mensaje,
            border_color="#9D50BB",
            color="white",
            bgcolor="#111111",
        )

        # =================================
        # MENÚ ADMIN
        # =================================

        def on_cargar_manual(ev):
            def _hilo():
                ruta = pdf_manager.pedir_ruta_pdf("Seleccionar PDF a cargar")
                if ruta:
                    exito, mensaje = pdf_manager.cargar_pdf(ruta)
                    color = "#7CFC00" if exito else "#FF4500"
                    mostrar_snack(mensaje, color=color)
            threading.Thread(target=_hilo, daemon=True).start()

        def on_actualizar_manual(ev):
            def _hilo():
                ruta = pdf_manager.pedir_ruta_pdf("Seleccionar PDF corregido")
                if ruta:
                    exito, mensaje = pdf_manager.actualizar_pdf(ruta)
                    color = "#7CFC00" if exito else "#FF4500"
                    mostrar_snack(mensaje, color=color)
            threading.Thread(target=_hilo, daemon=True).start()

        admin_menu_button = ft.Container()
        if user_info["rol"] == "Admin":
            admin_menu_button = ft.PopupMenuButton(
                content=ft.Text("ADMIN", color="white"),
                tooltip="Menú Admin",
                bgcolor="#222222",
                items=[
                    ft.PopupMenuItem("CARGAR PDF", on_click=on_cargar_manual),
                    ft.PopupMenuItem("ACTUALIZAR MANUAL", on_click=on_actualizar_manual),
                    ft.PopupMenuItem("BORRAR MANUAL", on_click=lambda ev: borrar_manual_admin()),
                    ft.PopupMenuItem("CERRAR SESIÓN", on_click=lambda ev: cerrar_sesion()),
                ],
            )

        # =================================
        # LAYOUT DEL CHAT
        # =================================

        chat_page = ft.Column([
            ft.Row([
                ft.Text(
                    f"Bienvenido {user_info['nombre']}",
                    size=22, color="#D8B4FE", weight="bold",
                ),
                admin_menu_button,
            ], alignment="spaceBetween", vertical_alignment="center"),
            ft.Container(
                content=chat_display,
                expand=True,
                bgcolor="#000000cc",
                border_radius=20,
                padding=10,
            ),
            ft.Row([
                input_msg,
                ft.ElevatedButton(
                    "ENVIAR",
                    on_click=enviar_mensaje,
                    bgcolor="#6E48AA",
                    color="white",
                ),
            ], spacing=10),
        ], expand=True)

        if img_fondo:
            page.add(
                ft.Container(
                    expand=True,
                    image=ft.DecorationImage(src=img_fondo, fit=ft.ImageFit.COVER),
                    content=chat_page,
                )
            )
        else:
            page.add(chat_page)

        page.update()

    # =====================================
    # LOGIN
    # =====================================

    def login_click(e):
        resultado = auth.login(txt_user.value, txt_pass.value)

        if resultado:
            login_message.value = ""
            login_error_box.visible = False

            user_info["id"] = resultado["id"]
            user_info["nombre"] = resultado["nombre"]
            user_info["rol"] = resultado["rol"]
            cargar_chat()
        else:
            if database.usuario_existe(txt_user.value):
                mensaje = "Contraseña incorrecta"
            else:
                mensaje = "Usuario no registrado"

            login_message.value = mensaje
            login_message.color = "#FF4B4B"
            login_error_box.visible = True
            page.update()

    # =====================================
    # LOGIN UI
    # =====================================

    txt_user = ft.TextField(label="Usuario", width=300)

    txt_pass = ft.TextField(
        label="Contraseña",
        password=True,
        width=300,
        on_submit=login_click,
    )

    login_message = ft.Text("", size=16, weight="bold", color="#FF4B4B")

    login_error_box = ft.Container(
        content=login_message,
        bgcolor="#000000",
        padding=10,
        border_radius=10,
        visible=False,
        width=300,
    )

    login_ui = ft.Container(
        content=ft.Column([
            ft.Image(
                src=img_avatar,
                width=120, height=120,
                fit=ft.ImageFit.COVER,
            ) if img_avatar else ft.Text(
                "LUXO", size=30, color="#FFFFFF", weight="bold",
            ),
            login_error_box,
            ft.Text(
                "SISTEMA LUXO",
                size=25, weight="bold", color="#D8B4FE",
            ),
            txt_user,
            txt_pass,
            ft.ElevatedButton(
                "INGRESAR",
                on_click=login_click,
                width=300,
                bgcolor="#6E48AA",
                color="white",
            ),
        ],
        horizontal_alignment="center",
        spacing=20),
        padding=40,
        bgcolor="#1A1A1A",
        border_radius=20,
        image=ft.DecorationImage(src=img_fondo, fit=ft.ImageFit.COVER),
        clip_behavior=ft.ClipBehavior.HARD_EDGE,
    )

    page.vertical_alignment = "center"
    page.horizontal_alignment = "center"
    page.add(login_ui)


# =========================================
# EJECUTAR APP
# =========================================

ft.app(target=main)
