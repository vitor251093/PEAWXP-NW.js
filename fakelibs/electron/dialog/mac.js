/*
  Electron Docs
  https://www.electronjs.org/docs/latest/api/dialog

  Applescript Docs
  https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/AppendixA-AppleScriptObjCQuickTranslationGuide.html
  https://developer.apple.com/library/archive/releasenotes/InterapplicationCommunication/RN-JavaScriptForAutomation/Articles/OSX10-10.html
  https://github.com/JXA-Cookbook/JXA-Cookbook

  Display native system dialogs for opening and saving files, alerting, etc.
  Only available in the main process.

  Through AppleScript, it's possible to call the different types of dialogs.
  Some specific features are not available thought.
*/

const fs = require('fs')
const path = require('path')
const applescript = require('../utils/applescript')
const throwUnsupportedException = require('../utils/unsupported-exception')
const BaseDialog = require('./base')

class MacDialog extends BaseDialog {
  static showOpenDialogSync(window, {title, defaultPath, buttonLabel, filters, properties, message, securityScopedBookmarks}) {
    properties = properties || []
    const openFile = properties.includes('openFile')
    const openDirectory = properties.includes('openDirectory')
    const multiSelections = properties.includes('multiSelections')
    const showHiddenFiles = properties.includes('showHiddenFiles')
    const createDirectory = properties.includes('createDirectory')
    const noResolveAliases = properties.includes('noResolveAliases')
    const treatPackageAsDirectory = properties.includes('treatPackageAsDirectory')
    
    if (buttonLabel) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'buttonLabel' property in the 'properties' argument")
    }
    if (message) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'message' property in the 'properties' argument")
    }
    if (securityScopedBookmarks) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'securityScopedBookmarks' property in the 'properties' argument")
    }
    if (createDirectory) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'createDirectory' value in the 'properties' argument")
    }
    if (noResolveAliases) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'noResolveAliases' value in the 'properties' argument")
    }
    
    const fileOfFolderArg = openDirectory ? "folder" : "file"
    const promptArgs = title === undefined ? "" : `with prompt ${JSON.stringify(title)}`
    const filtersArgs = filters === undefined ? "" : `of type {${filters.flatMap(b => b.extensions).map(b => JSON.stringify(b)).join(", ")}}`
    const defaultPathArgs = defaultPath === undefined ? "" : `default location ${JSON.stringify(defaultPath)}`
    const invisiblesArgs = !showHiddenFiles ? "" : `invisibles true`
    const multiSelectionsArgs = !multiSelections ? "" : `multiple selections allowed true`
    const treatPackageAsDirectoryArgs = !treatPackageAsDirectory ? "" : `showing package contents true`
    
    let spawn = applescript.eval(`
      set AppleScript's text item delimiters to "\\n"
      set theFiles to choose ${fileOfFolderArg} ${promptArgs} ${filtersArgs} ${defaultPathArgs} ${invisiblesArgs} ${multiSelectionsArgs} ${treatPackageAsDirectoryArgs}
      set thePOSIXFiles to {}
      repeat with aFile in theFiles
        set end of thePOSIXFiles to POSIX path of aFile
      end repeat
      return thePOSIXFiles as string
    `)
    if (spawn.status === 1) {
      return undefined
    }
    let response = spawn.stdout
    return response.trim().split("\n")
  }

  static async showOpenDialog(window, opts) {
    let response = this.showOpenDialogSync(window, opts)
    return {
      canceled: response === undefined,
      filePaths: response
    }
  }

  static showSaveDialogSync(window, {title, defaultPath, buttonLabel, filters, message, nameFieldLabel, showsTagField, properties, securityScopedBookmarks}) {
    properties = properties || []
    const showHiddenFiles = properties.includes('showHiddenFiles')
    const createDirectory = properties.includes('createDirectory')
    const treatPackageAsDirectory = properties.includes('treatPackageAsDirectory')

    const extensions = filters === undefined ? [] : filters.flatMap(b => b.extensions)
    
    if (buttonLabel) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'buttonLabel' property in the 'properties' argument")
    }
    if (message) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'message' property in the 'properties' argument")
    }
    if (nameFieldLabel) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'nameFieldLabel' property in the 'properties' argument")
    }
    if (showsTagField) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'showsTagField' property in the 'properties' argument")
    }
    if (securityScopedBookmarks) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'securityScopedBookmarks' property in the 'properties' argument")
    }
    if (showHiddenFiles) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'showHiddenFiles' value in the 'properties' argument")
    }
    if (createDirectory) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'createDirectory' value in the 'properties' argument")
    }
    if (treatPackageAsDirectory) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'treatPackageAsDirectory' value in the 'properties' argument")
    }

    let defaultPathIsDirectory = false
    try {
      if (defaultPath) {
        defaultPathIsDirectory = fs.statSync(defaultPath).isDirectory()
      }
    }
    catch (err) {}

    let defaultFolder = defaultPath
    let defaultName = undefined
    if (defaultPath !== undefined && !defaultPathIsDirectory) {
      defaultFolder = path.dirname(defaultFolder)
      defaultName = path.basename(defaultFolder)
    }

    const promptArgs = title === undefined ? "" : `with prompt ${JSON.stringify(title)}`
    const filtersArgs = defaultName === undefined ? "" : `default name ${JSON.stringify(defaultName)}`
    const defaultPathArgs = defaultFolder === undefined ? "" : `default location ${JSON.stringify(defaultFolder)}`
    
    let spawn = applescript.eval(`
      set AppleScript's text item delimiters to "\\n"
      set theFile to choose file name ${promptArgs} ${filtersArgs} ${defaultPathArgs}
      set thePOSIXFile to POSIX path of theFile
    `)
    if (spawn.status === 1) {
      return undefined
    }
    let response = spawn.stdout
    let filename = response.trim()
    if (extensions.length === 1) {
      let extension = extension[0]
      if (path.extname(filename) !== `.${extension}`) {
        filename = `${filename}.${extension}`
      }
    }
    return filename
  }

  static async showSaveDialog(window, opts) {
    let response = this.showSaveDialogSync(window, opts)
    return {
      canceled: response === undefined,
      filePath: response
    }
  }

  static showMessageBoxSync(window, {message, type, buttons, defaultId, title, detail, icon, textWidth, cancelId, noLink, normalizeAccessKeys}) {
    if (detail) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'detail' property in the 'properties' argument")
    }
    if (icon) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'icon' property in the 'properties' argument")
    }
    if (textWidth) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'textWidth' property in the 'properties' argument")
    }
    if (noLink) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'noLink' property in the 'properties' argument")
    }
    if (normalizeAccessKeys) {
      throwUnsupportedException("dialog.showOpenDialog can't support the 'normalizeAccessKeys' property in the 'properties' argument")
    }

    const titleArgs = title === undefined ? "" : `with title ${JSON.stringify(title)}`
    const buttonsArgs = buttons === undefined ? "" : `buttons {${buttons.map(b => JSON.stringify(b)).join(", ")}}`
    const defaultBtnArgs = (buttons === undefined || defaultId === undefined) ? "" : `default button ${JSON.stringify(buttons[defaultId])}`
    const cancelBtnArgs = (buttons === undefined || cancelId === undefined) ? "" : `cancel button ${JSON.stringify(buttons[cancelId])}`

    const displayDialogIconByIcon = {
        "none": undefined,
        "info": "note",
        "error": "stop",
        "question": undefined,
        "warning": "caution"
    }
    const displayDialogIcon = displayDialogIconByIcon[type || "none"]
    const iconArgs = displayDialogIcon === undefined ? "" : `with icon ${displayDialogIcon}`
    let spawn = applescript.eval(`
      set theDialogText to ${JSON.stringify(message)}
      set theDialog to display dialog theDialogText ${buttonsArgs} ${defaultBtnArgs} ${cancelBtnArgs} ${titleArgs} ${iconArgs}
      button returned of theDialog
    `)
    if (spawn.status === 1) {
      return cancelId
    }
  
    let response = spawn.stdout
    if (response === null) {
      return null
    }
    return buttons.indexOf(response.trim())
  }

  static async showMessageBox(window, opts) {
    let index = this.showMessageBoxSync(window, opts)
    return {
      response: index
    }
  }

  static showErrorBox(title, content) {
    this.showMessageBoxSync({message:content, type:"error", title})
  }

  static async showCertificateTrustDialog(window, opts) {
    if (opts === undefined) {
      opts = window
      window = undefined
    }
    let certificate = opts.certificate
    let message = opts.message
  }
}
module.exports = MacDialog