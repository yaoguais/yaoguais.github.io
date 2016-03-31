<?php

require __DIR__ . '/Parsedown.php';
$tpl = file_get_contents(__DIR__ . '/article.tpl');
$root = realpath(__DIR__ . '/../');

$parseDown = new Parsedown();

$navFile = $root . '/md/index.md';
$toFile = str_replace('/md/index.md', '/index.html', $navFile);
$html = $parseDown->text(file_get_contents($navFile));
$html = preg_replace('/\?s=md\/(.+?)\/(.+?)\.md/', '/article/\1/\2.html', $html);
preg_match_all('/\/article\/(.+?)\/(.+?)\.html/', $html, $matches);
$navFiles = array_map(function ($val) use ($root) {
    return $root . $val;
}, $matches[0]);

$mdFiles = getFiles($root . '/md');
foreach ($mdFiles as $file) {
    if (!strrpos($file, '/md/index.md')) {
        $toFile = str_replace(['/md/', '.md'], ['/article/', '.html'], $file);
        if (!in_array($toFile, $navFiles)) {
            echo '[error] ',$file,"\n";
        }
        $toFileDir = dirname($toFile);
        if (!file_exists($toFileDir)) {
            mkdir($toFileDir);
        }
        $html = $parseDown->text(file_get_contents($file));
        $finalHtml = str_replace('{{content}}', $html, $tpl);
        file_put_contents($toFile, $finalHtml);
    }
}
echo count($navFiles), '/', count($mdFiles) - 1, "\n";
echo "done\n";

function getFiles($dir)
{
    $files = [];
    $fos = opendir($dir);
    while ($file = readdir($fos)) {
        if ($file != '.' && $file != '..') {
            $fullPath = $dir . '/' . $file;
            if (is_dir($fullPath)) {
                $subFiles = getFiles($fullPath);
                if ($subFiles) {
                    $files = array_merge($files, $subFiles);
                }
            } else {
                $files[] = $fullPath;
            }
        }
    }
    closedir($fos);
    return $files;
}