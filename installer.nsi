!include "MUI2.nsh"

Name "Nexus Inventory Hub"
OutFile "NexusInventory_Setup.exe"
InstallDir "$LOCALAPPDATA\NexusInventory"
RequestExecutionLevel user

!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "Turkish"

Section "Install"
  SetOutPath "$INSTDIR"
  File "nexus-inventory.exe"
  
  CreateShortCut "$DESKTOP\Nexus Inventory.lnk" "$INSTDIR\nexus-inventory.exe"
  CreateShortCut "$SMPROGRAMS\Nexus Inventory.lnk" "$INSTDIR\nexus-inventory.exe"
  
  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\nexus-inventory.exe"
  Delete "$INSTDIR\uninstall.exe"
  Delete "$DESKTOP\Nexus Inventory.lnk"
  Delete "$SMPROGRAMS\Nexus Inventory.lnk"
  RMDir "$INSTDIR"
SectionEnd
