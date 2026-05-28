import os

files = [
    'frontend/src/pages/ChatsInbox.js',
    'frontend/src/pages/CreateGroup.js',
    'frontend/src/pages/GroupChat.js',
    'frontend/src/pages/Groups.js',
    'frontend/src/pages/NotificationsInbox.js',
    'frontend/src/pages/Profile.js',
    'frontend/src/pages/Wallet.js'
]

import_stmt = 'import useIsMobile from "../hooks/useIsMobile";'

for f in files:
    if not os.path.exists(f):
        continue
    with open(f, 'r', encoding='utf-8') as file:
        lines = file.readlines()
    
    # Check if already imported
    if any('useIsMobile' in line for line in lines if line.startswith('import')):
        continue
        
    # Insert after first import
    for i, line in enumerate(lines):
        if line.startswith('import'):
            lines.insert(i + 1, import_stmt + '\n')
            break
            
    with open(f, 'w', encoding='utf-8') as file:
        file.writelines(lines)
