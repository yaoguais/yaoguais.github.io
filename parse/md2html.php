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
$finalHtml = str_replace(['{{title}}', '{{content}}'], ["YaoGuai's Blog", $html], $tpl);
$finalHtml = str_replace("Yaoguai's", 'Yaoguai\'s <span style="font-size:10px">while($loved || !give_up());</span>', $finalHtml);
$finalHtml .= '<style>
.mdBlock ol{ padding-left: 5px; list-style: none; } .mdBlock ol li{ padding: 2px 0; font-size: 18px; }
h2 a:hover{text-decoration: none}
h3{border:none}
</style>';
$finalHtml = preg_replace('/\/\/index-hidden-begin.+\/\/index-hidden-end/s','',$finalHtml);
file_put_contents($toFile, $finalHtml);

$navContent = file_get_contents($navFile);
$navContent = preg_replace('/\?s=md\/(.+?)\/(.+?)\.md/', '/article/\1/\2.html', $navContent);
preg_match_all('/\[(.+?)\]\s*\((.+?)\)/', $navContent, $matches);
$readMeContent = "#[Yaoguai's blog](https://yaoguais.github.io)#\n\n";
foreach ($matches[1] as $i => $title) {
    if ($i > 0) {
        $link = $matches[2][$i];
        if (substr($link, 0, 4) != 'http') {
            $link = 'https://yaoguais.github.io' . $link;
        }
        $readMeContent .= "$i. [$title]($link)\n";
    }
}
$readMeContent .= "\n#[click here to view](https://yaoguais.github.io)#\n";
file_put_contents($root . '/README.md', $readMeContent);

$mdFiles = getFiles($root . '/md');
foreach ($mdFiles as $file) {
    if (!strrpos($file, '/md/index.md')) {
        $toFile = str_replace(['/md/', '.md'], ['/article/', '.html'], $file);
        if (!in_array($toFile, $navFiles)) {
            echo '[error] ', $file, "\n";
        }
        $toFileDir = dirname($toFile);
        if (!file_exists($toFileDir)) {
            mkdir($toFileDir);
        }
        $html = $parseDown->text(file_get_contents($file));
        preg_match('/<h\d>(.+?)<\/h\d>/is', $html, $match);
        $title = $match[1];
        $finalHtml = str_replace(['{{title}}', '{{content}}'], [$title, $html], $tpl);
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