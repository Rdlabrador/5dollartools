-- Convierte un libro a PDF con Microsoft Excel para Mac.
-- Uso a mano: osascript mac/scripts/office-excel.applescript /ruta/entrada.xlsx /ruta/salida.pdf
on run argv
	set entrada to item 1 of argv
	set salida to item 2 of argv
	set estabaAbierto to application "Microsoft Excel" is running
	tell application "Microsoft Excel"
		set display alerts to false
		open workbook workbook file name entrada update links do not update links read only true
		set libro to active workbook
		try
			save workbook as libro filename salida file format PDF file format
		on error m
			close libro saving no
			if not estabaAbierto then quit
			error m
		end try
		close libro saving no
		if not estabaAbierto then quit
	end tell
	return "ok"
end run
