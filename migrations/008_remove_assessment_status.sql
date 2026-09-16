-- Remove status guidance for the retired proficiency assessment command.
DELETE FROM status_messages
WHERE content LIKE '%--assess%'
   OR content LIKE '%/assess%';
