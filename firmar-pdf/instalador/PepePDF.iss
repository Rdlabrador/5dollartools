; Instalador de PepePDF (Inno Setup 6). Toma el exe de la carpeta publish cada vez que se compila.
#define AppName "PepePDF"
#define AppVersion "1.2.0"
#define Publisher "5dollartools"
#define AppUrl "https://github.com/Rdlabrador/5dollartools"
#define ExePublicado "..\src\bin\Release\net8.0-windows10.0.19041.0\win-x64\publish\PepePDF.exe"

[Setup]
AppId={{B7E4C2A1-5D3F-4E8A-9C61-2F0A7D94E3B8}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#Publisher}
AppPublisherURL={#AppUrl}
AppSupportURL={#AppUrl}
VersionInfoVersion={#AppVersion}
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\PepePDF
DisableDirPage=yes
DisableProgramGroupPage=yes
DefaultGroupName={#AppName}
UninstallDisplayIcon={app}\PepePDF.exe
UninstallDisplayName={#AppName}
SetupIconFile=..\src\icono.ico
OutputDir=..\descargar
OutputBaseFilename=PepePDF-Setup
Compression=lzma2/max
SolidCompression=yes
CloseApplications=yes
RestartApplications=no
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
spanish.TaskDesktop=Crear acceso directo en el escritorio
english.TaskDesktop=Create a shortcut on the desktop
spanish.TaskPdf=Abrir los PDF con PepePDF
english.TaskPdf=Open PDF files with PepePDF
spanish.TaskPdfDesc=Aparecerá en "Abrir con" al hacer clic derecho en un PDF
english.TaskPdfDesc=It will appear in "Open with" when you right-click a PDF
spanish.RunApp=Abrir PepePDF
english.RunApp=Open PepePDF
spanish.NoWebView=PepePDF necesita Microsoft Edge WebView2, que no se encontró en este equipo.%n%nDescárguelo gratis desde:%nhttps://developer.microsoft.com/microsoft-edge/webview2/%n%nLa instalación continuará de todos modos.
english.NoWebView=PepePDF needs Microsoft Edge WebView2, which was not found on this computer.%n%nDownload it for free from:%nhttps://developer.microsoft.com/microsoft-edge/webview2/%n%nThe installation will continue anyway.

[Tasks]
Name: "desktopicon"; Description: "{cm:TaskDesktop}"
Name: "pdfassoc"; Description: "{cm:TaskPdf}"; GroupDescription: "{cm:TaskPdfDesc}"

[Files]
Source: "{#ExePublicado}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\src\icono.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\PepePDF.exe"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\PepePDF.exe"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Classes\PepePDF.Document"; ValueType: string; ValueData: "PDF - PepePDF"; Flags: uninsdeletekey; Tasks: pdfassoc
Root: HKCU; Subkey: "Software\Classes\PepePDF.Document\DefaultIcon"; ValueType: string; ValueData: "{app}\PepePDF.exe,0"; Tasks: pdfassoc
Root: HKCU; Subkey: "Software\Classes\PepePDF.Document\shell\open\command"; ValueType: string; ValueData: """{app}\PepePDF.exe"" ""%1"""; Tasks: pdfassoc
Root: HKCU; Subkey: "Software\Classes\.pdf\OpenWithProgids"; ValueType: string; ValueName: "PepePDF.Document"; ValueData: ""; Flags: uninsdeletevalue; Tasks: pdfassoc
Root: HKCU; Subkey: "Software\Classes\Applications\PepePDF.exe"; ValueType: string; ValueName: "FriendlyAppName"; ValueData: "PepePDF"; Flags: uninsdeletekey; Tasks: pdfassoc
Root: HKCU; Subkey: "Software\Classes\Applications\PepePDF.exe\SupportedTypes"; ValueType: string; ValueName: ".pdf"; ValueData: ""; Tasks: pdfassoc
Root: HKCU; Subkey: "Software\Classes\Applications\PepePDF.exe\shell\open\command"; ValueType: string; ValueData: """{app}\PepePDF.exe"" ""%1"""; Tasks: pdfassoc

[Run]
Filename: "{app}\PepePDF.exe"; Description: "{cm:RunApp}"; Flags: nowait postinstall skipifsilent

; Los datos del usuario (%LOCALAPPDATA%\FirmarPDF) no se tocan al desinstalar.

[Code]
function WebView2Instalado(): Boolean;
var pv: String;
begin
  Result := False;
  if RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', pv) and (pv <> '') and (pv <> '0.0.0.0') then Result := True
  else if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', pv) and (pv <> '') and (pv <> '0.0.0.0') then Result := True
  else if RegQueryStringValue(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', pv) and (pv <> '') and (pv <> '0.0.0.0') then Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and not WebView2Instalado() then
    MsgBox(CustomMessage('NoWebView'), mbInformation, MB_OK);
end;
