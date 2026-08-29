<?php
declare(strict_types=1);

function erp_session_cookie_name(array $config): string
{
    return isset($config['session']['cookie_name']) && is_string($config['session']['cookie_name'])
        ? $config['session']['cookie_name']
        : 'erp_session';
}
