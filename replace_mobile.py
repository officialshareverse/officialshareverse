import os
import re

files_to_update = [
    "ChatsInbox.js",
    "CreateGroup.js",
    "GroupChat.js",
    "Groups.js",
    "NotificationsInbox.js",
    "Profile.js",
    "Wallet.js"
]

base_dir = r"c:\Users\ACER\mystartup\frontend\src\pages"

# regex for the useState block
useState_pattern = re.compile(r'const\s+\[isMobile,\s*setIsMobile\]\s*=\s*useState\(\(\)\s*=>\s*typeof\s+window\s*!==\s*"undefined"\s*\?\s*window\.matchMedia\("\([^)]+\)"\)\.matches\s*:\s*false\s*\);', re.DOTALL)

# regex for the useEffect block
useEffect_pattern = re.compile(r'useEffect\(\(\)\s*=>\s*\{\s*if\s*\(typeof\s+window\s*===\s*"undefined"\)\s*\{\s*return\s+undefined;\s*\}\s*const\s+mediaQuery\s*=\s*window\.matchMedia\("\([^)]+\)"\);\s*const\s+handleChange\s*=\s*\(event\)\s*=>\s*setIsMobile\(event\.matches\);\s*setIsMobile\(mediaQuery\.matches\);\s*if\s*\(typeof\s+mediaQuery\.addEventListener\s*===\s*"function"\)\s*\{\s*mediaQuery\.addEventListener\("change",\s*handleChange\);\s*return\s*\(\)\s*=>\s*mediaQuery\.removeEventListener\("change",\s*handleChange\);\s*\}\s*mediaQuery\.addListener\(handleChange\);\s*return\s*\(\)\s*=>\s*mediaQuery\.removeListener\(handleChange\);\s*\},\s*\[\]\);', re.DOTALL)

for fname in files_to_update:
    fpath = os.path.join(base_dir, fname)
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    # check if we need to update
    if "window.matchMedia" not in content or "setIsMobile" not in content:
        continue

    # remove useEffect block
    content = useEffect_pattern.sub('', content)

    # replace useState block with const isMobile = useIsMobile();
    content = useState_pattern.sub('const isMobile = useIsMobile();', content)

    # add import if not there
    if 'useIsMobile' not in content:
        # Find last import statement
        import_idx = content.rfind("import ")
        if import_idx != -1:
            end_of_line = content.find("\n", import_idx)
            content = content[:end_of_line+1] + 'import useIsMobile from "../hooks/useIsMobile";\n' + content[end_of_line+1:]
        else:
            content = 'import useIsMobile from "../hooks/useIsMobile";\n' + content

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)

print("Replacement complete.")
