import re

files_to_update = {
    r"C:\Users\ACER\mystartup\backend\core\views\common.py": [
        (301, "group"),
        (303, "group"),
        (375, "group"),
        (382, "locked_group"),
        (478, "locked_group"),
        (497, "locked_group"),
        (1328, "locked_group"),
        (1336, "locked_group"),
        (1421, "locked_group"),
        (1429, "locked_group"),
        (1440, "locked_group"),
        (1448, "locked_group"),
        (1463, "locked_group"),
        (1471, "locked_group"),
    ],
    r"C:\Users\ACER\mystartup\backend\core\views\groups_management.py": [
        (222, "locked_group"),
        (294, "locked_group"),
        (382, "locked_group"),
        (513, "locked_group"),
        (520, "locked_group"),
        (634, "locked_group"),
    ],
    r"C:\Users\ACER\mystartup\backend\core\views\groups_public.py": [
        (149, "locked_group"),
        (155, "locked_group"),
    ],
}

for filepath, calls in files_to_update.items():
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    # Process from bottom to top so line numbers don't shift! Wait, I'm just replacing lines, not adding new ones (unless I split, but I'll just append to the existing line or inside the parenthesis)
    # Actually, some create_notification calls span multiple lines.
    # We can search for the matching closing parenthesis of create_notification.
    for line_idx, group_var in sorted([(l-1, g) for l, g in calls], reverse=True):
        # find the end of the create_notification call starting at line_idx
        idx = line_idx
        open_parens = 0
        started = False
        while idx < len(lines):
            for i, char in enumerate(lines[idx]):
                if char == '(':
                    open_parens += 1
                    started = True
                elif char == ')':
                    open_parens -= 1
                    if started and open_parens == 0:
                        # Found the closing parenthesis.
                        # We want to insert ", group_id={group_var}.id" before this closing parenthesis.
                        lines[idx] = lines[idx][:i] + f", group_id={group_var}.id" + lines[idx][i:]
                        break
            if started and open_parens == 0:
                break
            idx += 1

    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print(f"Updated {filepath}")
