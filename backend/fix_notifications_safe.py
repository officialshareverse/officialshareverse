import re
import sys

def add_group_id(filepath, var_name):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find create_notification(...) blocks
    # We want to replace the closing parenthesis `)` with `, group_id=var_name.id)`
    # but only for calls that do not already have group_id
    
    # We can match `create_notification( ... )`
    # and use a regex callback to append `, group_id=var_name.id` just before the last `)`
    
    def replacer(match):
        inner = match.group(1)
        if "group_id=" in inner:
            return match.group(0)
        
        # Determine if it's a multi-line call
        if '\n' in inner:
            # We assume it ends with `        )`
            # We want to insert `, group_id=var_name.id` after the last kwarg
            # The safest way is to replace the very last `)`
            pass
        return f"create_notification({inner}, group_id={var_name}.id)"

    # A regex to match create_notification(...) correctly, allowing nested parentheses is tricky
    # But we know these calls don't have nested parentheses except for f-strings and simple variables
    # Let's do a simple balanced parenthesis search
    
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
            # If the last non-whitespace char is a comma, just append
            if inner_content.rstrip().endswith(','):
                # multi-line usually ends with `    )`
                # Let's just insert `\n            group_id={var_name}.id,` before the last `\n        )`
                # or simpler: `group_id={var_name}.id`
                # Let's just replace `)` with `, group_id={var_name}.id)` but keep trailing whitespaces
                out.append(f"create_notification({inner_content}group_id={var_name}.id)")
            else:
                out.append(f"create_notification({inner_content}, group_id={var_name}.id)")
        else:
            out.append(f"create_notification({inner_content})")
            
        idx = i + 1

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write("".join(out))
    print(f"Updated {filepath}")


add_group_id(r"C:\Users\ACER\mystartup\backend\core\views\groups_management.py", "locked_group")

# For common.py, it uses `group` in some places and `locked_group` in others.
# We will do it carefully for common.py
def process_common():
    filepath = r"C:\Users\ACER\mystartup\backend\core\views\common.py"
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
            # Look at the previous 150 characters to see if we are in a block that uses `locked_group` or `group`
            prev_context = content[max(0, start-150):start]
            if "locked_group" in prev_context:
                var_name = "locked_group"
            else:
                var_name = "group"
                
            out.append(f"create_notification({inner_content}, group_id={var_name}.id)")
        else:
            out.append(f"create_notification({inner_content})")
            
        idx = i + 1

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write("".join(out))
    print(f"Updated common.py")

process_common()
