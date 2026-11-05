-- Convierte un documento a PDF con Microsoft Word para Mac.
-- Uso a mano: osascript mac/scripts/office-word.applescript /ruta/entrada.docx /ruta/salida.pdf
-- (el programa usa rutas dentro de ~/Library/Containers/com.microsoft.Word/Data para no pedir permiso de carpeta)
on run argv
	set entrada to item 1 of argv
	set salida to item 2 of argv
	set estabaAbierto to application "Microsoft Word" is running
	tell application "Microsoft Word"
		open file name entrada read only true add to recent files false
		set d to active document
		try
			save as d file name salida file format format PDF
		on error m
			close d saving no
			if not estabaAbierto then quit saving no
			error m
		end try
		close d saving no
		if not estabaAbierto then quit saving no
	end tell
	return "ok"
end run
