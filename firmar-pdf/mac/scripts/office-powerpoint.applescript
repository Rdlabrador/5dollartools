-- Convierte una presentacion a PDF con Microsoft PowerPoint para Mac.
-- Uso a mano: osascript mac/scripts/office-powerpoint.applescript /ruta/entrada.pptx /ruta/salida.pdf
on run argv
	set entrada to item 1 of argv
	set salida to item 2 of argv
	set estabaAbierto to application "Microsoft PowerPoint" is running
	tell application "Microsoft PowerPoint"
		open entrada
		set p to active presentation
		try
			save p in salida as save as PDF
		on error m
			close p saving no
			if not estabaAbierto then quit
			error m
		end try
		close p saving no
		if not estabaAbierto then quit
	end tell
	return "ok"
end run
