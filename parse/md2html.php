<?php

require __DIR__ . '/Parsedown.php';
$tpl = file_get_contents(__DIR__ . '/article.tpl');
$root = realpath(__DIR__ . '/../');

$parseDown = new Parsedown();
$mdFiles = getFiles($root . '/md');

foreach ($mdFiles as $file) {
    if(strrpos($file, '/md/index.md')){

    }else{
        $toFile = str_replace(['/md/', '.md'], ['/article/', '.html'], $file);
        $toFileDir = dirname($toFile);
        if (!file_exists($toFileDir)) {
            mkdir($toFileDir);
        }
        $html = $parseDown->text(file_get_contents($file));
        $finalHtml = str_replace('{{content}}', $html, $tpl);
        file_put_contents($toFile, $finalHtml);
    }
}
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