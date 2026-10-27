# Ask notes metadata migration

Original filenames and body bytes are preserved. originals/ contains exact backups; prepared/ contains reviewed metadata plus unchanged originals. manifest.json records SHA-256 hashes.

To roll back, restore each file from originals/ to the same filename in the Ask directory recorded in manifest.json, after checking that the live file still matches its afterHash. Do not overwrite subsequent edits.
