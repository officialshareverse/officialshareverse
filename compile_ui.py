import os
import glob

def compile_codebase():
    base_dir = r"c:\Users\ACER\mystartup\frontend"
    output_file = r"c:\Users\ACER\mystartup\shareverse_desktop_ui_codebase.txt"
    
    # Files and patterns to include
    include_patterns = [
        "package.json",
        "tailwind.config.js",
        "postcss.config.js",
        "src/**/*.js",
        "src/**/*.jsx",
        "src/**/*.css"
    ]
    
    exclude_substrings = [
        ".test.js",
        "__mocks__",
        "node_modules"
    ]
    
    all_files = []
    
    for pattern in include_patterns:
        search_path = os.path.join(base_dir, pattern)
        # glob with recursive=True
        matched_files = glob.glob(search_path, recursive=True)
        for filepath in matched_files:
            if os.path.isfile(filepath):
                # normalize path and check exclusions
                norm_path = os.path.normpath(filepath)
                if not any(excl in norm_path for excl in exclude_substrings):
                    all_files.append(norm_path)
    
    # Remove duplicates preserving order
    all_files = list(dict.fromkeys(all_files))
    
    with open(output_file, "w", encoding="utf-8") as outfile:
        outfile.write("# Shareverse Desktop UI Codebase\n\n")
        
        for filepath in all_files:
            try:
                with open(filepath, "r", encoding="utf-8") as infile:
                    content = infile.read()
                
                # Relativize path for nicer reading
                rel_path = os.path.relpath(filepath, base_dir)
                
                outfile.write(f"--- File: {rel_path} ---\n")
                outfile.write(content)
                outfile.write("\n\n")
            except Exception as e:
                outfile.write(f"--- Error reading file: {filepath} ({e}) ---\n\n")
                
    print(f"Successfully compiled {len(all_files)} files into {output_file}")

if __name__ == '__main__':
    compile_codebase()
