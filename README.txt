REGISTRAR QUEUE SYSTEM - UPDATED FILES

1. Back up your current project folder.
2. Replace the matching project files with the files in this folder.
3. Keep the Firebase project configuration in firebase.js unchanged unless your Firebase project changes.
4. Make sure the Firestore users/{adminUid} document has role: "admin".
5. Make sure Firebase Authentication Email/Password and Anonymous sign-in are enabled.
6. Deploy the updated Firestore rules that permit authorized admins to update ticket status and allow the student queue page to read the queue fields it displays.
7. Open the project using the same local server or hosting setup you currently use.

RECEIPT PRINTING
When an administrator clicks Mark Done, the system updates the ticket to done, retrieves the saved ticket record, and opens the browser print dialog for a transaction completion receipt. Select the connected printer in the print dialog. The receipt layout is set up for an 80mm thermal printer; regular printers can also be selected, though scaling may need adjustment.

IMPORTANT
The current student form does not collect student name or student ID, so the receipt contains ticket number, service, issue time, called time, completion time, staff email, and Firebase ticket reference. It is a transaction completion acknowledgment, not an official payment receipt.

PUBLIC TV QUEUE DISPLAY
The new display.html, display.css, and display.js files create a separate read-only screen for the television. Open display.html on the TV computer using the same web server or hosted site. The page listens to the existing tickets collection and updates automatically when the administrator changes a ticket status. It shows the current ticket, the next five waiting tickets, the waiting count, and completed tickets today. Use the fullscreen button or press F11 in the browser.

The TV page signs in with Firebase Anonymous Authentication, so Anonymous sign-in must be enabled. Firestore rules must allow authenticated/anonymous clients to read only the queue data needed by the student and TV screens, while reserving ticket creation and status changes for the intended clients/admins. Do not use unrestricted public write rules. Because the current student page also reads the tickets collection, review the existing rules before deployment to make sure studentUid and other private fields are not exposed more broadly than intended.

DEVICE SETUP
- Student computer: open index.html (ticket issuing page).
- Administrator computer: open login.html, then use the admin dashboard.
- Television computer: open display.html and switch the browser to fullscreen.
- All devices must have internet access and use the same Firebase project.
