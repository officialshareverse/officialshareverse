import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    out = []
    idx = 0
    while idx < len(content):
        match = re.search(r'create_notification\s*\(', content[idx:])
        if not match:
            out.append(content[idx:])
            break
            
        start = idx + match.start()
        out.append(content[idx:start])
        
        # find matching parenthesis
        p_count = 0
        i = start + len(match.group()) - 1
        while i < len(content):
            if content[i] == '(':
                p_count += 1
            elif content[i] == ')':
                p_count -= 1
                if p_count == 0:
                    break
            i += 1
            
        inner_content = content[start+len(match.group()):i]
        
        if "group_id=" not in inner_content:
            # determine var_name
            prev_context = content[max(0, start-150):start]
            # Use 'locked_group' if it's in the immediate context, else 'group'
            if "locked_group." in inner_content or "locked_group=" in inner_content or "locked_group" in prev_context:
                var_name = "locked_group"
            else:
                var_name = "group"
                
            stripped = inner_content.rstrip()
            if stripped.endswith(','):
                # Has a trailing comma, just append group_id=var_name.id
                # but keep the trailing whitespace before inserting
                trailing_ws = inner_content[len(stripped):]
                out.append(f"create_notification({stripped} group_id={var_name}.id,{trailing_ws})")
            else:
                # No trailing comma, append `, group_id=var_name.id`
                out.append(f"create_notification({inner_content}, group_id={var_name}.id)")
        else:
            out.append(f"create_notification({inner_content})")
            
        idx = i + 1

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write("".join(out))
    print(f"Updated {filepath}")

process_file(r"C:\Users\ACER\mystartup\backend\core\views\common.py")
process_file(r"C:\Users\ACER\mystartup\backend\core\views\groups_management.py")
