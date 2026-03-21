/**
 * Google Apps Script — Creates a branded Beacon Student Referral Form
 *
 * HOW TO USE:
 * 1. Go to https://script.google.com
 * 2. Click "New Project"
 * 3. Paste this entire script
 * 4. Click Run (play button)
 * 5. Authorize when prompted
 * 6. Check the Execution Log for the form URL
 * 7. Share that URL with teachers
 *
 * The form responses automatically go to a Google Sheet.
 * Download that Sheet as CSV → import into Beacon.
 */

function createBeaconReferralForm() {
  // Create the form
  const form = FormApp.create('Student Referral — Beacon');

  // Set description with Clear Path branding
  form.setDescription(
    'Use this form to refer a student to the school counselor.\n\n' +
    'All responses are confidential and reviewed by your campus counselor.\n\n' +
    'Powered by Beacon — Clear Path Education Group'
  );

  // Collect email addresses (optional — helps counselor follow up with teacher)
  form.setCollectEmail(false);

  // Set confirmation message
  form.setConfirmationMessage(
    'Thank you! Your referral has been submitted.\n\n' +
    'The counselor will review it and follow up as needed. ' +
    'If this is an emergency, please contact administration immediately.'
  );

  // Allow response editing (teacher can update after submitting)
  form.setAllowResponseEdits(true);

  // ── Question 1: Student Name (required) ──
  form.addTextItem()
    .setTitle('Student Name')
    .setHelpText('First and last name of the student')
    .setRequired(true);

  // ── Question 2: Grade (required) ──
  form.addListItem()
    .setTitle('Grade')
    .setHelpText('Student\'s current grade level')
    .setChoiceValues(['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade'])
    .setRequired(true);

  // ── Question 3: Teacher Name (required) ──
  form.addTextItem()
    .setTitle('Teacher Name')
    .setHelpText('Your name (the referring teacher)')
    .setRequired(true);

  // ── Question 4: Concern Type (required) ──
  form.addListItem()
    .setTitle('Concern Type')
    .setHelpText('Primary area of concern')
    .setChoiceValues([
      'Academic',
      'Behavioral',
      'Social-Emotional',
      'Family Situation',
      'Attendance',
      'Crisis',
      'Self-Referral',
    ])
    .setRequired(true);

  // ── Question 5: Urgency (required) ──
  form.addMultipleChoiceItem()
    .setTitle('Urgency')
    .setHelpText(
      'Routine = general concern, no immediate risk\n' +
      'Soon = needs attention within a few days\n' +
      'Urgent = immediate safety concern or crisis'
    )
    .setChoiceValues(['Routine', 'Soon', 'Urgent'])
    .setRequired(true);

  // ── Question 6: Notes (optional) ──
  form.addParagraphTextItem()
    .setTitle('Notes')
    .setHelpText(
      'Describe the concern, what you have observed, and any steps already taken. ' +
      'Include specific examples if possible.'
    )
    .setRequired(false);

  // ── Question 7: Previous actions (optional) ──
  form.addCheckboxItem()
    .setTitle('Steps Already Taken')
    .setHelpText('Check any that apply')
    .setChoiceValues([
      'Contacted parent/guardian',
      'Discussed with student',
      'Implemented classroom intervention',
      'Consulted with grade-level team',
      'Referred to RTI/MTSS team',
      'Contacted administration',
      'None yet — seeking counselor guidance',
    ])
    .setRequired(false);

  // ── Question 8: Preferred contact method (optional) ──
  form.addMultipleChoiceItem()
    .setTitle('How should the counselor follow up with you?')
    .setChoiceValues([
      'Email',
      'In person',
      'Phone/text',
      'No follow-up needed — just wanted to flag',
    ])
    .setRequired(false);

  // Create a linked spreadsheet for responses
  const ss = SpreadsheetApp.create('Beacon Referral Responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // Rename the response sheet
  const sheets = ss.getSheets();
  if (sheets.length > 0) {
    sheets[0].setName('Referrals');
  }

  // Add a header row with Beacon branding to the spreadsheet
  const headerSheet = ss.insertSheet('Instructions');
  headerSheet.getRange('A1').setValue('Beacon — Student Referral Responses');
  headerSheet.getRange('A1').setFontSize(16).setFontWeight('bold').setFontColor('#2A9D8F');
  headerSheet.getRange('A2').setValue('Clear Path Education Group');
  headerSheet.getRange('A2').setFontSize(12).setFontColor('#6b7280');
  headerSheet.getRange('A4').setValue('How to import into Beacon:');
  headerSheet.getRange('A4').setFontWeight('bold');
  headerSheet.getRange('A5').setValue('1. Go to the "Referrals" sheet tab');
  headerSheet.getRange('A6').setValue('2. File → Download → Comma Separated Values (.csv)');
  headerSheet.getRange('A7').setValue('3. In Beacon, go to Referrals → Import CSV');
  headerSheet.getRange('A8').setValue('4. Upload the downloaded CSV file');
  headerSheet.getRange('A9').setValue('5. Review the preview and click Import');
  headerSheet.getRange('A11').setValue('Note: Column headers must include "Student Name" for the import to work.');
  headerSheet.getRange('A11').setFontColor('#ef4444');

  // Rename the response sheet columns to match Beacon's expected CSV format
  // (Google Forms auto-creates columns from question titles, which already match)

  // Log the URLs
  const formUrl = form.getPublishedUrl();
  const editUrl = form.getEditUrl();
  const sheetUrl = ss.getUrl();

  Logger.log('');
  Logger.log('========================================');
  Logger.log('  BEACON REFERRAL FORM CREATED');
  Logger.log('========================================');
  Logger.log('');
  Logger.log('Share this link with teachers:');
  Logger.log(formUrl);
  Logger.log('');
  Logger.log('Edit the form here:');
  Logger.log(editUrl);
  Logger.log('');
  Logger.log('View responses here:');
  Logger.log(sheetUrl);
  Logger.log('');
  Logger.log('To customize the form appearance:');
  Logger.log('1. Open the edit URL above');
  Logger.log('2. Click the palette icon (top right)');
  Logger.log('3. Set theme color to #2A9D8F (Beacon teal)');
  Logger.log('4. Upload the Clear Path logo as header image');
  Logger.log('========================================');

  // Return URLs for easy access
  return {
    formUrl: formUrl,
    editUrl: editUrl,
    sheetUrl: sheetUrl,
  };
}
