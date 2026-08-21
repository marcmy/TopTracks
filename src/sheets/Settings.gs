var TopTracksSettings = (function () {
  var SHEET_NAME = 'Settings';
  var CELLS = Object.freeze({
    exceptionalDiscount: 'B4',
    strongDiscount: 'B5',
    moderateDiscount: 'B6',
    starExceptional: 'B9',
    starStrong: 'B10',
    sheetLoggingEnabled: 'B11',
    status: 'B13',
    lastApplied: 'B14'
  });

  function discountToRatio(discount) {
    return 1 - Number(discount);
  }

  function ratioToDiscount(ratio) {
    return 1 - Number(ratio);
  }

  function parseValues(values) {
    var exceptionalDiscount = Number(values.exceptionalDiscount);
    var strongDiscount = Number(values.strongDiscount);
    var moderateDiscount = Number(values.moderateDiscount);

    if (
      !isFinite(exceptionalDiscount) || !isFinite(strongDiscount) || !isFinite(moderateDiscount) ||
      exceptionalDiscount < 0 || exceptionalDiscount > 1 ||
      strongDiscount < 0 || strongDiscount > 1 ||
      moderateDiscount < 0 || moderateDiscount > 1 ||
      exceptionalDiscount < strongDiscount || strongDiscount < moderateDiscount
    ) {
      throw new Error(
        'Tier percentages must be between 0% and 100% and satisfy Exceptional >= Strong >= Moderate.'
      );
    }

    return {
      thresholds: {
        exceptionalMaxRatio: discountToRatio(exceptionalDiscount),
        strongMaxRatio: discountToRatio(strongDiscount),
        moderateMaxRatio: discountToRatio(moderateDiscount)
      },
      starExceptional: Boolean(values.starExceptional),
      starStrong: Boolean(values.starStrong),
      sheetLoggingEnabled: Boolean(values.sheetLoggingEnabled)
    };
  }

  function readSheet(sheet) {
    return parseValues({
      exceptionalDiscount: sheet.getRange(CELLS.exceptionalDiscount).getValue(),
      strongDiscount: sheet.getRange(CELLS.strongDiscount).getValue(),
      moderateDiscount: sheet.getRange(CELLS.moderateDiscount).getValue(),
      starExceptional: sheet.getRange(CELLS.starExceptional).getValue(),
      starStrong: sheet.getRange(CELLS.starStrong).getValue(),
      sheetLoggingEnabled: sheet.getRange(CELLS.sheetLoggingEnabled).getValue()
    });
  }

  function applyFormatting(sheet) {
    sheet.setFrozenRows(2);
    sheet.setColumnWidth(1, 290);
    sheet.setColumnWidth(2, 190);
    sheet.setColumnWidth(3, 420);

    if (!sheet.getRange('A1:C1').isPartOfMerge()) sheet.getRange('A1:C1').merge();
    sheet.getRange('A1')
      .setValue('TopTracks Settings')
      .setFontSize(16)
      .setFontWeight('bold');
    if (!sheet.getRange('A2:C2').isPartOfMerge()) sheet.getRange('A2:C2').merge();
    sheet.getRange('A2')
      .setValue('Edit the blue cells. Valid changes apply automatically; no Apps Script editor needed.')
      .setFontStyle('italic');

    sheet.getRange('A3:C3').setValues([['Deal tier', 'Minimum below max', 'Meaning']]).setFontWeight('bold');
    sheet.getRange('A4').setValue('Exceptional');
    sheet.getRange('A5').setValue('Strong');
    sheet.getRange('A6').setValue('Moderate');
    sheet.getRange('A7:C7').setValues([[
      'Marginal',
      '',
      'Anything below the Moderate threshold, including an exact max-price match.'
    ]]);
    sheet.getRange('C4:C6').setValues([
      ['Current price is at least this far below your Keepa max.'],
      ['Below Exceptional, at least this far below max.'],
      ['Below Strong, at least this far below max.']
    ]);
    sheet.getRange('B4:B6').setNumberFormat('0%');

    var percentRule = SpreadsheetApp.newDataValidation()
      .requireNumberBetween(0, 1)
      .setAllowInvalid(false)
      .setHelpText('Enter a percentage from 0% to 100%.')
      .build();
    sheet.getRange('B4:B6').setDataValidation(percentRule);

    sheet.getRange('A8:C8').setValues([['Gmail / history', 'Setting', 'What it does']]).setFontWeight('bold');
    sheet.getRange('A9').setValue('Star Exceptional');
    sheet.getRange('A10').setValue('Star Strong');
    sheet.getRange('A11').setValue('Spreadsheet history');
    sheet.getRange('C9:C11').setValues([
      ['Adds Gmail STARRED to Exceptional alerts.'],
      ['Adds Gmail STARRED to Strong alerts.'],
      ['Keep logging processed offers to TopTracks / Best Deals.']
    ]);
    var checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    sheet.getRange('B9:B11').setDataValidation(checkboxRule);

    sheet.getRange('A13').setValue('Validation');
    sheet.getRange(CELLS.status).setFormula(
      '=IF(AND(B4>=B5,B5>=B6,B4<=1,B6>=0),"✓ Valid — changes apply automatically","⚠ Exceptional must be ≥ Strong ≥ Moderate")'
    );
    sheet.getRange('A14').setValue('Last applied');

    sheet.getRange('B4:B6').setBackground('#d9eaf7');
    sheet.getRange('B9:B11').setBackground('#d9eaf7');
    sheet.getRange('A3:C3').setBackground('#eeeeee');
    sheet.getRange('A8:C8').setBackground('#eeeeee');
    sheet.getRange('A1:C14').setVerticalAlignment('middle');
  }

  function seedValues(sheet, config) {
    sheet.getRange(CELLS.exceptionalDiscount).setValue(ratioToDiscount(config.thresholds.exceptionalMaxRatio));
    sheet.getRange(CELLS.strongDiscount).setValue(ratioToDiscount(config.thresholds.strongMaxRatio));
    sheet.getRange(CELLS.moderateDiscount).setValue(ratioToDiscount(config.thresholds.moderateMaxRatio));
    sheet.getRange(CELLS.starExceptional).setValue(Boolean(config.starExceptional));
    sheet.getRange(CELLS.starStrong).setValue(Boolean(config.starStrong));
    sheet.getRange(CELLS.sheetLoggingEnabled).setValue(Boolean(config.sheet.enabled));
  }

  function ensureSheet(spreadsheet, config) {
    var sheet = spreadsheet.getSheetByName(SHEET_NAME);
    var needsSetup = false;
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
      needsSetup = true;
    } else if (sheet.getLastRow() === 0) {
      needsSetup = true;
    }

    if (needsSetup) {
      seedValues(sheet, config);
      applyFormatting(sheet);
    }
    return sheet;
  }

  function applyFromSpreadsheet(spreadsheet) {
    var sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('TopTracks Settings sheet was not found.');
    var settings = readSheet(sheet);
    var applied = TopTracksConfig.setUserSettings(settings);
    sheet.getRange(CELLS.lastApplied).setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    return applied;
  }

  function editTouchesSettings(range) {
    if (!range || range.getSheet().getName() !== SHEET_NAME) return false;
    var rowStart = range.getRow();
    var rowEnd = range.getLastRow();
    var colStart = range.getColumn();
    var colEnd = range.getLastColumn();
    if (colStart > 2 || colEnd < 2) return false;
    return (rowStart <= 6 && rowEnd >= 4) || (rowStart <= 11 && rowEnd >= 9);
  }

  function handleEdit(event) {
    if (!event || !event.range || !event.source || !editTouchesSettings(event.range)) return;
    try {
      applyFromSpreadsheet(event.source);
    } catch (error) {
      var sheet = event.source.getSheetByName(SHEET_NAME);
      if (sheet) {
        sheet.getRange(CELLS.lastApplied).setValue(
          'Not applied: ' + (error && error.message ? error.message : String(error))
        );
      }
      throw error;
    }
  }

  return {
    SHEET_NAME: SHEET_NAME,
    ensureSheet: ensureSheet,
    readSheet: readSheet,
    applyFromSpreadsheet: applyFromSpreadsheet,
    handleEdit: handleEdit,
    _test: {
      CELLS: CELLS,
      discountToRatio: discountToRatio,
      ratioToDiscount: ratioToDiscount,
      parseValues: parseValues
    }
  };
})();

function handleTopTracksSettingsEdit(e) {
  return TopTracksSettings.handleEdit(e);
}
